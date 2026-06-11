# 10 - Testing Strategy and Test Cases

Generated from repository state on 2026-06-11. No secrets are included; environment-variable names are documented without values.

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
- Local model file discovery, incomplete-file filtering, unavailable-drive reconciliation, local model server command/status, and chat selection rejection for unavailable local models.
- Packaging configuration for branded macOS DMG output and local non-notarized `build:mac` script behavior.
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
   8 |   mergeDiscoveredLocalModelEntries,
   9 | } from "../src/main/local-model-files";
   9 |
  10 | const TEST_DIR = join(tmpdir(), `hermes-local-models-${Date.now()}`);
  11 |
  12 | beforeEach(() => {
  13 |   mkdirSync(TEST_DIR, { recursive: true });
  14 | });
  15 |
  16 | afterEach(() => {
  17 |   rmSync(TEST_DIR, { recursive: true, force: true });
  18 | });
  19 |
  20 | describe("local model file discovery", () => {
  21 |   it("discovers GGUF and safetensors model files under configured roots", () => {
  22 |     const mainStore = join(TEST_DIR, "MainStore", "AI_Models");
  23 |     const desktop = join(TEST_DIR, "Desktop", "AI_Models");
  24 |     mkdirSync(join(mainStore, "GGUF"), { recursive: true });
  25 |     mkdirSync(join(desktop, "Transformers"), { recursive: true });
  26 |
  27 |     const gguf = join(mainStore, "GGUF", "Hermes-3-Llama-3.1-8B-Q4_K_M.gguf");
  28 |     const safetensors = join(
  29 |       desktop,
  30 |       "Transformers",
  31 |       "Qwen3-Coder-30B.safetensors",
  32 |     );
  33 |     writeFileSync(gguf, Buffer.alloc(1_100_000));
  34 |     writeFileSync(
  35 |       join(mainStore, "GGUF", "._Hermes-3-Llama-3.1-8B-Q4_K_M.gguf"),
  36 |       "",
  37 |     );
  38 |     writeFileSync(join(mainStore, "STT.bin"), Buffer.alloc(1_100_000));
  39 |     writeFileSync(safetensors, Buffer.alloc(1_100_000));
  40 |
  41 |     expect(discoverLocalModelFiles([mainStore, desktop])).toEqual([
  42 |       { path: gguf, root: mainStore, format: "gguf" },
  43 |       { path: safetensors, root: desktop, format: "safetensors" },
  44 |     ]);
  45 |   });
  46 |
  47 |   it("skips tiny model files that are usually incomplete downloads or LFS pointers", () => {
  48 |     const root = join(TEST_DIR, "AI_Models");
  49 |     mkdirSync(join(root, "GGUF"), { recursive: true });
  50 |
  51 |     writeFileSync(join(root, "GGUF", "broken.gguf"), "version https://git-lfs");
  52 |
  53 |     expect(discoverLocalModelFiles([root])).toEqual([]);
  54 |   });
  55 |
  56 |   it("builds stable custom-provider entries that preserve local server base URL", () => {
  48 |     const root = join(TEST_DIR, "AI_Models");
  49 |     const modelPath = join(root, "GGUF", "Qwen3.6-27B-Q4_K_M.gguf");
  50 |
  51 |     const entries = buildLocalModelEntries([
  52 |       { path: modelPath, root, format: "gguf" },
  53 |     ]);
  54 |
  55 |     expect(entries).toEqual([
  56 |       expect.objectContaining({
  57 |         id: expect.stringMatching(/^local-file-/),
  58 |         name: "Local Qwen3.6 27B Q4 K M",
  59 |         provider: "custom",
  60 |         model: modelPath,
  61 |         baseUrl: "http://localhost:8080/v1",
  62 |         source: "local-file",
  63 |         modelPath,
  64 |         modelRoot: root,
  65 |         modelFormat: "gguf",
  66 |         launchable: true,
  67 |         available: true,
  68 |         rootAvailable: true,
  62 |         source: "local-file",
  63 |         modelPath,
  64 |         modelFormat: "gguf",
  65 |         launchable: true,
  66 |       }),
  67 |     ]);
  68 |   });
  69 | });
  70 |
```

Paperclip tests validate URL normalization and sidecar behavior:

```ts
   1 | import { describe, expect, it } from "vitest";
   2 | import {
   3 |   DEFAULT_PAPERCLIP_URL,
   4 |   mergePaperclipConfigData,
   5 |   normalizePaperclipUrl,
   6 |   readPaperclipConfigFromData,
   7 | } from "../src/main/paperclip";
   8 |
   9 | describe("Paperclip sidecar config", () => {
  10 |   it("normalizes empty and bare Paperclip URLs", () => {
  11 |     expect(normalizePaperclipUrl("")).toBe(DEFAULT_PAPERCLIP_URL);
  12 |     expect(normalizePaperclipUrl("localhost:3100/")).toBe(
  13 |       "http://localhost:3100",
  14 |     );
  15 |     expect(normalizePaperclipUrl("http://127.0.0.1:3100///")).toBe(
  16 |       "http://127.0.0.1:3100",
  17 |     );
  18 |   });
  19 |
  20 |   it("rejects non-http Paperclip URLs", () => {
  21 |     expect(normalizePaperclipUrl("file:///tmp/paperclip")).toBe(
  22 |       DEFAULT_PAPERCLIP_URL,
  23 |     );
  24 |     expect(normalizePaperclipUrl("javascript://alert(1)")).toBe(
  25 |       DEFAULT_PAPERCLIP_URL,
  26 |     );
  27 |   });
  28 |
  29 |   it("reads defaults when desktop config has no Paperclip block", () => {
  30 |     expect(readPaperclipConfigFromData({})).toEqual({
  31 |       serverUrl: DEFAULT_PAPERCLIP_URL,
  32 |       telemetryDisabled: true,
  33 |     });
  34 |   });
  35 |
  36 |   it("merges Paperclip config without discarding unrelated desktop settings", () => {
  37 |     const next = mergePaperclipConfigData(
  38 |       { connectionMode: "local", remoteUrl: "http://example.test" },
  39 |       { serverUrl: "localhost:3100/", telemetryDisabled: false },
  40 |     );
  41 |
  42 |     expect(next).toEqual({
  43 |       connectionMode: "local",
  44 |       remoteUrl: "http://example.test",
  45 |       paperclip: {
  46 |         serverUrl: "http://localhost:3100",
  47 |         telemetryDisabled: false,
  48 |       },
  49 |     });
  50 |   });
  51 | });
  52 |
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
  14 | const mainSrc = readFileSync(join(ROOT, "src/main/index.ts"), "utf-8");
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
