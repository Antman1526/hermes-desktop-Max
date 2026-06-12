# 14 - Security Implementation and Best Practices

Generated from repository state on 2026-06-12. No secrets are included; environment-variable names are documented without values.

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
 160 |
 161 | function getCached<T>(key: string): T | undefined {
 162 |   const entry = _cache.get(key);
 163 |   if (!entry) return undefined;
 164 |   if (Date.now() - entry.ts > CACHE_TTL) {
 165 |     _cache.delete(key);
 166 |     return undefined;
 167 |   }
 168 |   return entry.data as T;
 169 | }
 170 |
 171 | function setCache(key: string, data: unknown): void {
 172 |   _cache.set(key, { data, ts: Date.now() });
 173 | }
 174 |
 175 | function invalidateCache(prefix: string): void {
 176 |   for (const key of _cache.keys()) {
 177 |     if (key.startsWith(prefix)) _cache.delete(key);
 178 |   }
```

```ts
  46 |   return join(HERMES_HOME, "desktop.json");
  47 | }
  48 |
  49 | export function getPaperclipNpmCacheDir(): string {
  50 |   return join(HERMES_HOME, "paperclip-npm-cache");
  51 | }
  52 |
  53 | function paperclipLogFile(): string {
  54 |   return join(HERMES_HOME, "paperclip.log");
  55 | }
  56 |
  57 | function ensurePaperclipRuntimeDirs(): void {
  58 |   mkdirSync(getPaperclipNpmCacheDir(), { recursive: true });
  59 | }
  60 |
  61 | function appendPaperclipLog(chunk: Buffer | string): void {
  62 |   try {
```

## Local Model Launch Restrictions

The `llama-server` launcher rejects non-GGUF files and rejects paths outside discovered local model folders.

```ts
  31 | const LOG_FILE = join(HERMES_HOME, "local-model-server.log");
  32 | const LLAMA_LOG_FILE = join(HERMES_HOME, "local-model-server-llama.log");
  33 | const LLAMA_SERVER_CANDIDATES = [
  34 |   "/opt/homebrew/bin/llama-server",
  35 |   "/usr/local/bin/llama-server",
  36 | ];
  37 | const LOCAL_MODEL_SERVER_MAX_PORT = 8099;
  38 | const SERVER_START_TIMEOUT_MS = 300_000;
  39 | const SERVER_START_POLL_MS = 500;
  40 |
  41 | let localModelProcess: ChildProcess | null = null;
  42 |
  43 | function logLocalModelServer(message: string): void {
  44 |   try {
  45 |     appendFileSync(
  46 |       LOG_FILE,
  47 |       `[${new Date().toISOString()}] ${message}\n`,
  48 |       "utf-8",
  49 |     );
  50 |   } catch {
  51 |     /* best effort */
  52 |   }
  53 | }
  54 |
  55 | export function localModelServerEnv(
  56 |   sourceEnv: NodeJS.ProcessEnv = process.env,
  57 | ): NodeJS.ProcessEnv {
  58 |   const env: NodeJS.ProcessEnv = {
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
