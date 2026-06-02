# 14 - Security Implementation and Best Practices

Generated from repository state on 2026-06-02. No secrets are included; environment-variable names are documented without values.

## Electron Hardening

Security-critical renderer operations are isolated behind preload. External navigation and webviews are restricted by allowlists.

```ts
   1 | import type { WebContents, WebPreferences } from "electron";
   2 | import { pathToFileURL } from "url";
   3 | 
   4 | const EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);
   5 | const LOCAL_WEBVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
   6 | 
   7 | type WebviewPreferences = WebPreferences & {
   8 |   preloadURL?: string;
   9 | };
  10 | 
  11 | function parseUrl(rawUrl: unknown): URL | null {
  12 |   if (typeof rawUrl !== "string") return null;
  13 |   try {
  14 |     return new URL(rawUrl);
  15 |   } catch {
  16 |     return null;
  17 |   }
  18 | }
  19 | 
  20 | export function isAllowedExternalUrl(rawUrl: unknown): rawUrl is string {
  21 |   const url = parseUrl(rawUrl);
  22 |   return !!url && EXTERNAL_PROTOCOLS.has(url.protocol);
  23 | }
  24 | 
  25 | export function isAllowedAppNavigationUrl(
  26 |   rawUrl: unknown,
  27 |   rendererHtmlPath: string,
  28 |   devServerUrl?: string,
  29 | ): rawUrl is string {
  30 |   const url = parseUrl(rawUrl);
  31 |   if (!url) return false;
  32 | 
  33 |   const devServer = parseUrl(devServerUrl);
  34 |   if (devServer) {
  35 |     return url.origin === devServer.origin;
  36 |   }
  37 | 
  38 |   const rendererUrl = pathToFileURL(rendererHtmlPath);
  39 |   return (
  40 |     url.protocol === "file:" && url.href.split("#")[0] === rendererUrl.href
  41 |   );
  42 | }
  43 | 
  44 | export function isAllowedWebviewUrl(rawUrl: unknown): rawUrl is string {
  45 |   const url = parseUrl(rawUrl);
  46 |   if (!url || url.protocol !== "http:") return false;
  47 |   if (!LOCAL_WEBVIEW_HOSTS.has(url.hostname)) return false;
  48 | 
  49 |   const port = Number(url.port);
  50 |   return Number.isInteger(port) && port >= 1024 && port <= 65535;
  51 | }
  52 | 
  53 | export function hardenWebviewPreferences(
  54 |   webPreferences: WebviewPreferences,
  55 | ): void {
  56 |   delete webPreferences.preload;
  57 |   delete webPreferences.preloadURL;
  58 |   webPreferences.nodeIntegration = false;
  59 |   webPreferences.contextIsolation = true;
  60 |   webPreferences.sandbox = true;
  61 |   webPreferences.webSecurity = true;
  62 |   webPreferences.allowRunningInsecureContent = false;
  63 | }
  64 | 
  65 | export function hardenAttachedWebContents(webContents: WebContents): void {
  66 |   webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  67 |   webContents.on("will-navigate", (event, url) => {
```

## BrowserWindow Expectations

The production renderer should run with context isolation, no Node integration, controlled preload, denied arbitrary navigation, and hardened webview preferences. `hardenAttachedWebContents` denies popups and prevents non-local webview navigation.

## IPC Boundary

Renderer input enters privileged code through IPC only. Risk areas are channels that accept file paths, URLs, env keys, commands, or external provider config:

- `read-file`, `read-directory`, `open-file-in-editor`, `read-image-file`.
- `open-external`, `open-paperclip`.
- `set-env`, `set-config`, `set-connection-config`, `set-ssh-config`.
- `start-local-model-server`, `start-paperclip`, Claw3d process channels.

## Input Validation Examples

`validateEnvEntry` rejects invalid environment names and multiline values. `normalizePaperclipUrl` allows only HTTP/HTTPS and falls back to localhost.

```ts
 160 |     const eqIndex = trimmed.indexOf("=");
 161 |     const key = trimmed.substring(0, eqIndex).trim();
 162 |     let value = trimmed.substring(eqIndex + 1).trim();
 163 | 
 164 |     if (
 165 |       (value.startsWith('"') && value.endsWith('"')) ||
 166 |       (value.startsWith("'") && value.endsWith("'"))
 167 |     ) {
 168 |       value = value.slice(1, -1);
 169 |     }
 170 | 
 171 |     result[key] = value;
 172 |   }
 173 | 
 174 |   setCache(cacheKey, result);
 175 |   return result;
 176 | }
 177 | 
 178 | export function setEnvValue(
```

```ts
  46 | 
  47 | export function normalizePaperclipUrl(input: string): string {
  48 |   const trimmed = input.trim();
  49 |   if (!trimmed) return DEFAULT_PAPERCLIP_URL;
  50 |   const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
  51 |     ? trimmed
  52 |     : `http://${trimmed}`;
  53 |   try {
  54 |     const parsed = new URL(withProtocol);
  55 |     if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
  56 |       return DEFAULT_PAPERCLIP_URL;
  57 |     }
  58 |     return withProtocol.replace(/\/+$/, "");
  59 |   } catch {
  60 |     return DEFAULT_PAPERCLIP_URL;
  61 |   }
  62 | }
```

## Local Model Launch Restrictions

The `llama-server` launcher rejects non-GGUF files and rejects paths outside discovered local model folders.

```ts
  31 |   baseUrl: string;
  32 |   pid: number | null;
  33 |   error?: string;
  34 | }
  35 | 
  36 | export function isLaunchableLocalModel(modelPath: string): boolean {
  37 |   return extname(modelPath).toLowerCase() === ".gguf";
  38 | }
  39 | 
  40 | export function isDiscoveredLocalModelPath(
  41 |   modelPath: string,
  42 |   files: Pick<LocalModelFile, "path" | "format">[] = discoverLocalModelFiles(),
  43 | ): boolean {
  44 |   return files.some(
  45 |     (file) => file.path === modelPath && file.format === "gguf",
  46 |   );
  47 | }
  48 | 
  49 | export function buildLlamaServerArgs(
  50 |   modelPath: string,
  51 |   port = LOCAL_MODEL_SERVER_PORT,
  52 | ): string[] {
  53 |   return [
  54 |     "--model",
  55 |     modelPath,
  56 |     "--host",
  57 |     "127.0.0.1",
  58 |     "--port",
```

## Current Security Trade-Offs

- Secrets are stored in local files, not OS keychain.
- The local user has full authority over Hermes files and subprocess launch.
- Unsigned local installers will trigger platform warnings.
- Some file path IPC channels depend on renderer-provided paths and need strict tests.

## Areas for Review

- Move secrets to Keychain/Credential Manager/libsecret with migration fallback.
- Add runtime validators for every IPC payload.
- Add a centralized URL/file-path policy module and use it in all handlers.
- Add redaction helpers for logs, thrown errors, and renderer-visible errors.
