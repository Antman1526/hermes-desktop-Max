# 10 - Testing Strategy and Test Cases

Generated from repository state on 2026-06-12. No secrets are included; environment-variable names are documented without values.

## Test Runner

Tests use Vitest 4 with jsdom, globals, and renderer setup file. Main-process tests mock filesystem/process/Electron boundaries where possible.

```ts
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@renderer": resolve(__dirname, "src/renderer/src"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    passWithNoTests: true,
    setupFiles: ["./src/renderer/src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
  },
});
```

## Test Coverage Areas

Top-level `tests/` covers:

- IPC handler registration and preload API surface.
- Electron security boundaries.
- Installer path utilities and provider install gates.
- Config YAML path reads/writes.
- Environment validation and connection config security.
- Hermes API streaming, SSE parsing, token reconciliation.
- Session decoding, session cache sync, session delete/history mapping.
- Local model file discovery and local model server command/status.
- Paperclip URL/config/status/start/stop.
- SSH remote path handling and tunnel config.
- Provider detection and custom provider auto-key selection.
- Skills CLI output and import handling.
- Cron jobs, schedules, tools, models, memory, profiles, locale.

Renderer colocated tests cover Chat utilities, keyboard behavior, Media utilities, Paperclip screen, Sessions screen, Skills screen, and i18n provider behavior.

## Representative Tests

Local model tests validate root scanning and launcher restrictions:

```ts
   1 | import { mkdirSync, rmSync, writeFileSync } from "fs";
   2 | import { join } from "path";
   3 | import { tmpdir } from "os";
   4 | import { afterEach, beforeEach, describe, expect, it } from "vitest";
   5 | import {
   6 |   buildLocalModelEntries,
   7 |   discoverLocalModelFiles,
   8 |   getLocalModelScanStatus,
   9 |   isLikelyChatLocalModelFile,
  10 |   mergeDiscoveredLocalModelEntries,
  11 |   rescanLocalModels,
  12 | } from "../src/main/local-model-files";
  13 |
  14 | const TEST_DIR = join(tmpdir(), `hermes-local-models-${Date.now()}`);
  15 |
  16 | beforeEach(() => {
  17 |   mkdirSync(TEST_DIR, { recursive: true });
  18 | });
  19 |
  20 | afterEach(() => {
  21 |   rmSync(TEST_DIR, { recursive: true, force: true });
  22 | });
  23 |
  24 | describe("local model file discovery", () => {
  25 |   it("discovers GGUF and safetensors model files under configured roots", () => {
  26 |     const mainStore = join(TEST_DIR, "MainStore", "AI_Models");
  27 |     const desktop = join(TEST_DIR, "Desktop", "AI_Models");
  28 |     mkdirSync(join(mainStore, "GGUF"), { recursive: true });
  29 |     mkdirSync(join(desktop, "Transformers"), { recursive: true });
  30 |
  31 |     const gguf = join(mainStore, "GGUF", "Hermes-3-Llama-3.1-8B-Q4_K_M.gguf");
  32 |     const safetensors = join(
  33 |       desktop,
  34 |       "Transformers",
  35 |       "Qwen3-Coder-30B.safetensors",
  36 |     );
  37 |     writeFileSync(gguf, Buffer.alloc(1_100_000));
  38 |     writeFileSync(
  39 |       join(mainStore, "GGUF", "._Hermes-3-Llama-3.1-8B-Q4_K_M.gguf"),
  40 |       "",
  41 |     );
  42 |     writeFileSync(join(mainStore, "STT.bin"), Buffer.alloc(1_100_000));
  43 |     writeFileSync(safetensors, Buffer.alloc(1_100_000));
  44 |
  45 |     expect(discoverLocalModelFiles([mainStore, desktop])).toEqual([
  46 |       expect.objectContaining({ path: gguf, root: mainStore, format: "gguf" }),
  47 |       expect.objectContaining({
  48 |         path: safetensors,
  49 |         root: desktop,
  50 |         format: "safetensors",
  51 |       }),
  52 |     ]);
  53 |   });
  54 |
  55 |   it("skips tiny model files that are usually incomplete downloads or LFS pointers", () => {
  56 |     const root = join(TEST_DIR, "AI_Models");
  57 |     mkdirSync(join(root, "GGUF"), { recursive: true });
  58 |
  59 |     writeFileSync(join(root, "GGUF", "broken.gguf"), "version https://git-lfs");
  60 |
  61 |     expect(discoverLocalModelFiles([root])).toEqual([]);
  62 |   });
  63 |
  64 |   it("skips embedding-only model files from chat model discovery", () => {
  65 |     const root = join(TEST_DIR, "AI_Models");
  66 |     mkdirSync(join(root, "GGUF"), { recursive: true });
  67 |     const chat = join(root, "GGUF", "Llama-3.2-3B-Instruct-Q4_K_M.gguf");
  68 |     const embedding = join(root, "GGUF", "nomic-embed-text-v1.5.f16.gguf");
  69 |     writeFileSync(chat, Buffer.alloc(1_100_000));
  70 |     writeFileSync(embedding, Buffer.alloc(1_100_000));
  71 |
  72 |     expect(isLikelyChatLocalModelFile(chat)).toBe(true);
  73 |     expect(isLikelyChatLocalModelFile(embedding)).toBe(false);
  74 |     expect(discoverLocalModelFiles([root])).toEqual([
  75 |       expect.objectContaining({ path: chat }),
  76 |     ]);
  77 |   });
  78 |
  79 |   it("builds stable custom-provider entries that preserve local server base URL", () => {
  80 |     const root = join(TEST_DIR, "AI_Models");
  81 |     const modelPath = join(root, "GGUF", "Qwen3.6-27B-Q4_K_M.gguf");
  82 |
  83 |     const entries = buildLocalModelEntries([
  84 |       { path: modelPath, root, format: "gguf" },
  85 |     ]);
  86 |
  87 |     expect(entries).toEqual([
  88 |       expect.objectContaining({
  89 |         id: expect.stringMatching(/^local-file-/),
  90 |         name: "Local Qwen3.6 27B Q4 K M",
  91 |         provider: "custom",
  92 |         model: modelPath,
  93 |         baseUrl: "http://localhost:8080/v1",
  94 |         source: "local-file",
  95 |         modelPath,
  96 |         modelFormat: "gguf",
  97 |         launchable: true,
  98 |         available: true,
  99 |         rootAvailable: true,
 100 |         modelRoot: root,
 101 |       }),
 102 |     ]);
 103 |   });
 104 |
 105 |   it("marks missing local-file entries unavailable without removing them", () => {
 106 |     const mainStore = join(TEST_DIR, "MainStore", "AI_Models");
 107 |     const desktop = join(TEST_DIR, "Desktop", "AI_Models");
 108 |     const presentPath = join(desktop, "GGUF", "Llama-3.2-3B.gguf");
 109 |     const unmountedPath = join(mainStore, "GGUF", "Hermes-3.gguf");
 110 |     mkdirSync(join(desktop, "GGUF"), { recursive: true });
 111 |     writeFileSync(presentPath, Buffer.alloc(1_100_000));
 112 |
 113 |     const existing = [
 114 |       {
 115 |         id: "cloud",
 116 |         name: "Cloud",
 117 |         provider: "openrouter",
 118 |         model: "anthropic/claude",
 119 |         baseUrl: "",
 120 |         createdAt: 1,
 121 |       },
 122 |       {
 123 |         id: "local-file-old",
 124 |         name: "Local Hermes",
 125 |         provider: "custom",
 126 |         model: unmountedPath,
 127 |         baseUrl: "http://localhost:8080/v1",
 128 |         source: "local-file" as const,
 129 |         modelPath: unmountedPath,
 130 |         modelFormat: "gguf" as const,
 131 |         modelRoot: mainStore,
 132 |         launchable: true,
 133 |         available: true,
 134 |         rootAvailable: true,
 135 |         createdAt: 2,
 136 |       },
 137 |     ];
 138 |
 139 |     const next = mergeDiscoveredLocalModelEntries(existing, {
 140 |       discovered: buildLocalModelEntries(
```

Paperclip tests validate URL normalization and sidecar behavior:

```ts
   1 | import http from "http";
   2 | import { AddressInfo } from "net";
   3 | import { afterEach, describe, expect, it } from "vitest";
   4 | import {
   5 |   buildPaperclipEnv,
   6 |   DEFAULT_PAPERCLIP_URL,
   7 |   DEFAULT_PAPERCLIP_VERSION,
   8 |   getPaperclipNpmCacheDir,
   9 |   mergePaperclipConfigData,
  10 |   normalizePaperclipUrl,
  11 |   PAPERCLIP_NPX_ARGS,
  12 |   PAPERCLIP_STARTUP_TIMEOUT_MS,
  13 |   readPaperclipConfigFromData,
  14 |   requestHealth,
  15 |   resolvePaperclipNpxCommand,
  16 | } from "../src/main/paperclip";
  17 |
  18 | describe("Paperclip sidecar config", () => {
  19 |   const servers: http.Server[] = [];
  20 |
  21 |   afterEach(async () => {
  22 |     await Promise.all(
  23 |       servers.map(
  24 |         (server) =>
  25 |           new Promise<void>((resolve) => {
  26 |             server.close(() => resolve());
  27 |           }),
  28 |       ),
  29 |     );
  30 |     servers.length = 0;
  31 |   });
  32 |
  33 |   it("normalizes empty and bare Paperclip URLs", () => {
  34 |     expect(normalizePaperclipUrl("")).toBe(DEFAULT_PAPERCLIP_URL);
  35 |     expect(normalizePaperclipUrl("localhost:3100/")).toBe(
  36 |       "http://localhost:3100",
  37 |     );
  38 |     expect(normalizePaperclipUrl("http://127.0.0.1:3100///")).toBe(
  39 |       "http://127.0.0.1:3100",
  40 |     );
  41 |   });
  42 |
  43 |   it("rejects non-http Paperclip URLs", () => {
  44 |     expect(normalizePaperclipUrl("file:///tmp/paperclip")).toBe(
  45 |       DEFAULT_PAPERCLIP_URL,
  46 |     );
  47 |     expect(normalizePaperclipUrl("javascript://alert(1)")).toBe(
  48 |       DEFAULT_PAPERCLIP_URL,
  49 |     );
  50 |   });
  51 |
  52 |   it("reads defaults when desktop config has no Paperclip block", () => {
  53 |     expect(readPaperclipConfigFromData({})).toEqual({
  54 |       serverUrl: DEFAULT_PAPERCLIP_URL,
  55 |       autoStart: true,
  56 |       telemetryDisabled: true,
  57 |     });
  58 |   });
  59 |
  60 |   it("merges Paperclip config without discarding unrelated desktop settings", () => {
  61 |     const next = mergePaperclipConfigData(
  62 |       { connectionMode: "local", remoteUrl: "http://example.test" },
  63 |       { serverUrl: "localhost:3100/", telemetryDisabled: false },
  64 |     );
  65 |
  66 |     expect(next).toEqual({
  67 |       connectionMode: "local",
  68 |       remoteUrl: "http://example.test",
  69 |       paperclip: {
  70 |         serverUrl: "http://localhost:3100",
  71 |         autoStart: true,
  72 |         telemetryDisabled: false,
  73 |       },
  74 |     });
  75 |   });
  76 |
  77 |   it("launches the requested Paperclip release through noninteractive npx", () => {
  78 |     expect(DEFAULT_PAPERCLIP_VERSION).toBe("2026.529.0");
  79 |     expect(PAPERCLIP_NPX_ARGS).toEqual([
  80 |       "--yes",
  81 |       `paperclipai@${DEFAULT_PAPERCLIP_VERSION}`,
  82 |       "run",
  83 |     ]);
  84 |   });
  85 |
  86 |   it("allows enough time for the pinned Paperclip release to finish startup", () => {
  87 |     expect(PAPERCLIP_STARTUP_TIMEOUT_MS).toBeGreaterThanOrEqual(180000);
  88 |   });
  89 |
  90 |   it("prefers a known absolute npx launcher when the app PATH is sparse", () => {
  91 |     expect(
  92 |       resolvePaperclipNpxCommand(
  93 |         (candidate) => candidate === "/opt/homebrew/bin/npx",
  94 |       ),
  95 |     ).toBe("/opt/homebrew/bin/npx");
  96 |   });
  97 |
  98 |   it("uses a Hermes-owned npm cache for npx", () => {
  99 |     const env = buildPaperclipEnv(
 100 |       {
 101 |         serverUrl: DEFAULT_PAPERCLIP_URL,
 102 |         autoStart: true,
 103 |         telemetryDisabled: true,
 104 |       },
 105 |       { PATH: "/usr/bin" },
 106 |     );
 107 |
 108 |     expect(env.PATH).toContain("/usr/bin");
 109 |     expect(env.npm_config_cache).toBe(getPaperclipNpmCacheDir());
 110 |     expect(env.NPM_CONFIG_CACHE).toBe(getPaperclipNpmCacheDir());
 111 |     expect(env.PAPERCLIP_TELEMETRY_DISABLED).toBe("1");
 112 |     expect(env.DO_NOT_TRACK).toBe("1");
 113 |   });
 114 |
 115 |   it("checks the Paperclip API health endpoint instead of the static UI shell", async () => {
 116 |     const requestedPaths: string[] = [];
 117 |     const server = http.createServer((req, res) => {
 118 |       requestedPaths.push(req.url ?? "");
 119 |       if (req.url === "/health") {
 120 |         res.writeHead(200, { "Content-Type": "text/html" });
 121 |         res.end('<!doctype html><div id="root"></div>');
 122 |         return;
 123 |       }
 124 |       if (req.url === "/api/health") {
 125 |         res.writeHead(200, { "Content-Type": "application/json" });
 126 |         res.end(JSON.stringify({ status: "ok", version: "2026.529.0" }));
 127 |         return;
 128 |       }
 129 |       res.writeHead(404);
 130 |       res.end();
 131 |     });
 132 |     servers.push(server);
 133 |
 134 |     await new Promise<void>((resolve) => server.listen(0, resolve));
 135 |     const { port } = server.address() as AddressInfo;
 136 |
 137 |     await expect(requestHealth(`http://127.0.0.1:${port}`)).resolves.toBe(true);
 138 |     expect(requestedPaths).toEqual(["/api/health"]);
 139 |   });
 140 | });
 141 |
```

Security tests validate allowed URLs and webview hardening:

```ts
   1 | import { describe, expect, it, vi } from "vitest";
   2 | import { pathToFileURL } from "url";
   3 | import { readFileSync } from "fs";
   4 | import { join } from "path";
   5 | import {
   6 |   hardenAttachedWebContents,
   7 |   hardenWebviewPreferences,
   8 |   isAllowedAppNavigationUrl,
   9 |   isAllowedExternalUrl,
  10 |   isAllowedWebviewUrl,
  11 | } from "../src/main/security";
  12 |
  13 | const ROOT = join(__dirname, "..");
  14 | const mainSrc = readFileSync(join(ROOT, "src/main/app-main.ts"), "utf-8");
  15 | const preloadSrc = readFileSync(join(ROOT, "src/preload/index.ts"), "utf-8");
  16 | const installerSrc = readFileSync(join(ROOT, "src/main/installer.ts"), "utf-8");
  17 |
  18 | describe("Electron main process hardening", () => {
  19 |   it("keeps the main renderer isolated from Node privileges", () => {
  20 |     expect(mainSrc).toContain("nodeIntegration: false");
  21 |     expect(mainSrc).toContain("contextIsolation: true");
  22 |     expect(mainSrc).toContain("sandbox: true");
  23 |     expect(mainSrc).toContain("webSecurity: true");
  24 |     expect(mainSrc).toContain("allowRunningInsecureContent: false");
  25 |   });
  26 |
  27 |   it("blocks untrusted top-level navigation and webview attachment", () => {
  28 |     expect(mainSrc).toContain("setWindowOpenHandler((details) => {");
  29 |     expect(mainSrc).toContain('webContents.on("will-navigate"');
  30 |     expect(mainSrc).toContain('"will-attach-webview"');
  31 |     expect(mainSrc).toContain("isAllowedAppNavigationUrl(");
  32 |     expect(mainSrc).toContain("isAllowedWebviewUrl(params.src)");
  33 |     expect(mainSrc).toContain("hardenWebviewPreferences(webPreferences)");
  34 |   });
  35 |
  36 |   it("keeps attached webviews constrained after initial attachment", () => {
  37 |     expect(mainSrc).toContain('app.on("web-contents-created"');
  38 |     expect(mainSrc).toContain('contents.getType() === "webview"');
  39 |     expect(mainSrc).toContain("hardenAttachedWebContents(contents)");
  40 |   });
  41 |
  42 |   it("routes shell.openExternal through the allowlist helper", () => {
  43 |     const directShellOpens = mainSrc.match(/shell\.openExternal\(/g) ?? [];
  44 |     expect(directShellOpens).toHaveLength(1);
  45 |     expect(mainSrc).toContain(
  46 |       "function openExternalUrl(rawUrl: unknown): void",
  47 |     );
  48 |   });
  49 |
  50 |   it("keeps the sandboxed main preload free of external runtime imports", () => {
  51 |     expect(preloadSrc).not.toContain("@electron-toolkit/preload");
  52 |   });
  53 |
  54 |   it("runs hermes doctor without a shell-built command string", () => {
  55 |     expect(installerSrc).toContain(
  56 |       'execFileSync(HERMES_PYTHON, hermesCliArgs(["doctor"])',
  57 |     );
  58 |     expect(installerSrc).not.toContain("execSync(`");
  59 |   });
  60 |
  61 |   it("keeps the Linux sudo precache install flow wired in", () => {
  62 |     expect(installerSrc).toContain(
  63 |       'import { precacheSudoCredentials } from "./sudoCreds"',
  64 |     );
  65 |     expect(installerSrc).toContain(
  66 |       "const sudoPrecache = await precacheSudoCredentials(",
  67 |     );
  68 |     expect(installerSrc).toContain("sudoPrecache.stop();");
  69 |   });
  70 | });
  71 |
  72 | describe("Electron external URL policy", () => {
  73 |   it("allows browser-safe external protocols", () => {
  74 |     expect(isAllowedExternalUrl("https://example.com/docs")).toBe(true);
  75 |     expect(isAllowedExternalUrl("http://localhost:3000")).toBe(true);
  76 |     expect(isAllowedExternalUrl("mailto:security@example.com")).toBe(true);
  77 |   });
  78 |
  79 |   it("blocks dangerous or ambiguous external URLs", () => {
  80 |     expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
  81 |     expect(
  82 |       isAllowedExternalUrl("data:text/html,<script>alert(1)</script>"),
  83 |     ).toBe(false);
  84 |     expect(isAllowedExternalUrl("file:///C:/Users/me/token.txt")).toBe(false);
  85 |     expect(isAllowedExternalUrl("/relative/path")).toBe(false);
  86 |     expect(isAllowedExternalUrl({ href: "https://example.com" })).toBe(false);
  87 |   });
  88 | });
  89 |
  90 | describe("Electron app navigation policy", () => {
  91 |   const rendererHtmlPath = "C:\\app\\out\\renderer\\index.html";
  92 |   const rendererUrl = pathToFileURL(rendererHtmlPath).href;
  93 |
  94 |   it("allows the packaged renderer file", () => {
  95 |     expect(isAllowedAppNavigationUrl(rendererUrl, rendererHtmlPath)).toBe(true);
  96 |     expect(
  97 |       isAllowedAppNavigationUrl(`${rendererUrl}#settings`, rendererHtmlPath),
  98 |     ).toBe(true);
  99 |   });
 100 |
 101 |   it("allows only the configured dev server origin in dev mode", () => {
 102 |     expect(
 103 |       isAllowedAppNavigationUrl(
 104 |         "http://localhost:5173/src/main.tsx",
 105 |         rendererHtmlPath,
 106 |         "http://localhost:5173",
 107 |       ),
 108 |     ).toBe(true);
 109 |     expect(
 110 |       isAllowedAppNavigationUrl(
 111 |         "http://localhost:3000",
 112 |         rendererHtmlPath,
 113 |         "http://localhost:5173",
 114 |       ),
 115 |     ).toBe(false);
 116 |   });
 117 |
 118 |   it("blocks navigation to other local or remote documents", () => {
 119 |     expect(
 120 |       isAllowedAppNavigationUrl(
 121 |         "file:///C:/Users/me/secrets.html",
 122 |         rendererHtmlPath,
 123 |       ),
 124 |     ).toBe(false);
 125 |     expect(
 126 |       isAllowedAppNavigationUrl("https://example.com", rendererHtmlPath),
 127 |     ).toBe(false);
 128 |   });
 129 | });
 130 |
 131 | describe("Electron webview policy", () => {
 132 |   it("allows only loopback HTTP URLs on app-controlled ports", () => {
 133 |     expect(isAllowedWebviewUrl("http://localhost:3000")).toBe(true);
 134 |     expect(isAllowedWebviewUrl("http://127.0.0.1:65535/path")).toBe(true);
 135 |     expect(isAllowedWebviewUrl("http://[::1]:3000")).toBe(true);
 136 |   });
 137 |
 138 |   it("blocks remote, privileged, and non-HTTP webview URLs", () => {
 139 |     expect(isAllowedWebviewUrl("https://localhost:3000")).toBe(false);
 140 |     expect(isAllowedWebviewUrl("http://example.com:3000")).toBe(false);
 141 |     expect(isAllowedWebviewUrl("http://localhost:80")).toBe(false);
 142 |     expect(isAllowedWebviewUrl("file:///C:/Users/me/page.html")).toBe(false);
 143 |     expect(isAllowedWebviewUrl("javascript:alert(1)")).toBe(false);
 144 |   });
 145 |
 146 |   it("removes privileged webview capabilities before attachment", () => {
 147 |     const webPreferences = {
 148 |       preload: "C:\\tmp\\evil-preload.js",
 149 |       preloadURL: "file:///C:/tmp/evil-preload.js",
 150 |       nodeIntegration: true,
 151 |       contextIsolation: false,
 152 |       sandbox: false,
 153 |       webSecurity: false,
 154 |       allowRunningInsecureContent: true,
 155 |     };
 156 |
 157 |     hardenWebviewPreferences(webPreferences);
 158 |
 159 |     expect(webPreferences).not.toHaveProperty("preload");
 160 |     expect(webPreferences).not.toHaveProperty("preloadURL");
```

## Verification Commands

```bash
npm run typecheck
npm test
npm run lint
```

For release builds:

```bash
npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac dmg --arm64 --publish never -c.mac.notarize=false
CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win nsis --x64 --publish never
```

## Test Data Principles

- Use temp directories for filesystem tests.
- Mock child processes instead of launching real Hermes/Paperclip/llama-server.
- Assert security-negative cases, not only allowed cases.
- Assert exact IPC surface so preload/main drift is caught.

## Areas for Review

- Should the project add Playwright/Electron smoke tests for the packaged app?
- Should local model server tests cover health-check races and stale PID files more deeply?
- Should package-build tests verify `electron-builder.yml` excludes docs/tests/scripts from packaged artifacts?
