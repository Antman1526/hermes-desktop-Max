# 09 - Configuration and Environment Variables

Generated from repository state on 2026-06-03. No secrets are included; environment-variable names are documented without values.

## Configuration Files

| File | Owner | Purpose |
| --- | --- | --- |
| `package.json` | repo | scripts, dependencies, app version |
| `electron-builder.yml` | repo | packaging targets, app ID, artifacts |
| `electron.vite.config.ts` | repo | main/preload/renderer build split |
| `vitest.config.ts` | repo | test runner config |
| `.env.example` | repo | optional renderer analytics variables |
| `~/.hermes/desktop.json` | desktop | connection mode, remote URL/key, SSH, Paperclip |
| `~/.hermes/.env` | Hermes profile | provider/tool/gateway secrets |
| `~/.hermes/config.yaml` | Hermes profile | Hermes Agent runtime config |
| `~/.hermes/models.json` | desktop | saved model library |

## Electron Builder Configuration

```yaml
appId: com.nousresearch.hermes
productName: Hermes Agent
directories:
  buildResources: build
files:
  - out/**
  - resources/**
  - package.json
  - "!**/.vscode/*"
  - "!src/*"
  - "!src/**"
  - "!tests/**"
  - "!docs/**"
  - "!scripts/**"
  - "!coverage/**"
  - "!*.log"
  - "!**/*.map"
  - "!**/.cache/**"
  - "!electron.vite.config.{js,ts,mjs,cjs}"
  - "!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}"
  - "!{.env,.env.*,.npmrc,pnpm-lock.yaml}"
  - "!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}"
asarUnpack:
  - resources/**
win:
  executableName: hermes-agent
  target:
    - nsis
    - portable
portable:
  artifactName: ${name}-${version}-portable.${ext}
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
  oneClick: true
  perMachine: false
mac:
  artifactName: ${name}-${version}-${arch}-${os}.${ext}
  icon: build/icon.icns
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.inherit.plist
  extendInfo:
    - NSCameraUsageDescription: Application requests access to the device's camera.
    - NSMicrophoneUsageDescription: Application requests access to the device's microphone.
    - NSDocumentsFolderUsageDescription: Application requests access to the user's Documents folder.
    - NSDownloadsFolderUsageDescription: Application requests access to the user's Downloads folder.
  hardenedRuntime: true
  gatekeeperAssess: false
  notarize: true
dmg:
  artifactName: ${name}-${version}-${arch}.${ext}
linux:
  target:
    - AppImage
    - snap
    - deb
    - rpm
  maintainer: electronjs.org
  vendor: Nous Research
  category: Utility
  synopsis: Self-improving AI assistant desktop app
  description: >-
    Hermes Desktop is a native desktop app for installing, configuring, and chatting
    with Hermes Agent — a self-improving AI assistant with tool use, multi-platform
    messaging, and a closed learning loop.
appImage:
  artifactName: ${name}-${version}.${ext}
deb:
  # Run chmod 4755 on chrome-sandbox so Electron's setuid sandbox helper
  # works on modern Linux distros that disable unprivileged user
  # namespaces (Ubuntu 24.04+, etc.). Closes #395.
  afterInstall: build/linux-after-install.sh
rpm:
  artifactName: ${name}-${version}.${ext}
  # Same SUID fix for .rpm consumers (Fedora 40+ also restricts userns).
  afterInstall: build/linux-after-install.sh
npmRebuild: false
publish:
  provider: github
  owner: fathah
  repo: hermes-desktop
```

## Desktop Connection Config Shape

```ts
  17 | export interface SshConnectionConfig {
  18 |   host: string;
  19 |   port: number;
  20 |   username: string;
  21 |   keyPath: string;
  22 |   remotePort: number;
  23 |   localPort: number;
  24 | }
  25 |
  26 | export interface ConnectionConfig {
  27 |   mode: "local" | "remote" | "ssh";
  28 |   remoteUrl: string;
  29 |   apiKey: string;
  30 |   ssh: SshConnectionConfig;
  31 | }
  32 |
  33 | export interface PublicConnectionConfig {
  34 |   mode: "local" | "remote" | "ssh";
  35 |   remoteUrl: string;
  36 |   hasApiKey: boolean;
  37 |   // Length of the stored API key, exposed so the renderer can show a
  38 |   // mask that matches the real value's width. The secret itself never
  39 |   // leaves the main process. 0 when no key is set.
  40 |   apiKeyLength: number;
  41 |   ssh: SshConnectionConfig;
  42 | }
  43 |
  44 | // Lazy getter — avoids circular dependency with installer.ts
  45 | // (HERMES_HOME may not be assigned yet when this module first loads)
  46 | function desktopConfigFile(): string {
  47 |   return join(HERMES_HOME, "desktop.json");
  48 | }
  49 |
  50 | export function readDesktopConfig(): Record<string, unknown> {
  51 |   try {
  52 |     const f = desktopConfigFile();
  53 |     if (!existsSync(f)) return {};
  54 |     return JSON.parse(readFileSync(f, "utf-8"));
  55 |   } catch {
  56 |     return {};
  57 |   }
  58 | }
  59 |
  60 | export function writeDesktopConfig(data: Record<string, unknown>): void {
  61 |   if (!existsSync(HERMES_HOME)) {
  62 |     mkdirSync(HERMES_HOME, { recursive: true });
  63 |   }
  64 |   writeFileSync(desktopConfigFile(), JSON.stringify(data, null, 2), "utf-8");
```

## Environment Variable Categories

### Desktop build/runtime

- `ELECTRON_RENDERER_URL` - dev renderer URL.
- `ENABLE_CDP=1` and `CDP_PORT` - optional Chrome DevTools Protocol port for debugging.
- `PORTABLE_EXECUTABLE_DIR` - portable Windows build detection.
- `HERMES_HOME` - optional override for Hermes data root.
- `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` - optional analytics.

### Model providers

`OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `TOGETHER_API_KEY`, `FIREWORKS_API_KEY`, `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `PERPLEXITY_API_KEY`, `HF_TOKEN`, `QWEN_API_KEY`, `MINIMAX_API_KEY`, `GLM_API_KEY`, `KIMI_API_KEY`, `NVIDIA_API_KEY`, `CUSTOM_API_KEY`.

### Tools and services

`EXA_API_KEY`, `PARALLEL_API_KEY`, `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, `HONCHO_API_KEY`, `BROWSERBASE_API_KEY`, `VOICE_TOOLS_OPENAI_KEY`, `TINKER_API_KEY`, `WANDB_API_KEY`.

### Messaging

`TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `WHATSAPP_API_TOKEN`, `MATRIX_ACCESS_TOKEN`, `MATTERMOST_TOKEN`, `TWILIO_AUTH_TOKEN`, `WEIXIN_BOT_TOKEN`, `HASS_TOKEN`.

## Config Mutation Rules

Environment keys must match `/^[A-Za-z_][A-Za-z0-9_]*$/` and values must be single-line strings.

```ts
 114 |   if (existing.mode === mode && existing.remoteUrl === remoteUrl) {
 115 |     return existing.apiKey;
 116 |   }
 117 |   return "";
 118 | }
 119 |
 120 | // ── In-memory cache with TTL ─────────────────────────────
 121 | const CACHE_TTL = 5000; // 5 seconds
 122 | const _cache = new Map<string, { data: unknown; ts: number }>();
 123 | const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
 124 |
 125 | function getCached<T>(key: string): T | undefined {
 126 |   const entry = _cache.get(key);
 127 |   if (!entry) return undefined;
 128 |   if (Date.now() - entry.ts > CACHE_TTL) {
 129 |     _cache.delete(key);
 130 |     return undefined;
 131 |   }
 132 |   return entry.data as T;
 133 | }
 134 |
 135 | function setCache(key: string, data: unknown): void {
 136 |   _cache.set(key, { data, ts: Date.now() });
 137 | }
 138 |
 139 | function invalidateCache(prefix: string): void {
 140 |   for (const key of _cache.keys()) {
 141 |     if (key.startsWith(prefix)) _cache.delete(key);
 142 |   }
 143 | }
 144 |
 145 | export function readEnv(profile?: string): Record<string, string> {
 146 |   const cacheKey = `env:${profile || "default"}`;
 147 |   const cached = getCached<Record<string, string>>(cacheKey);
 148 |   if (cached) return cached;
 149 |
 150 |   const { envFile } = profilePaths(profile);
 151 |   if (!existsSync(envFile)) return {};
 152 |
 153 |   const content = readFileSync(envFile, "utf-8");
 154 |   const result: Record<string, string> = {};
 155 |
 156 |   for (const line of content.split("\n")) {
 157 |     const trimmed = line.trim();
 158 |     if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
 159 |
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

## Areas for Review

- Should environment-variable definitions be generated from one shared provider registry?
- Should the desktop store user-facing config in a versioned file with migrations?
- Should config writes be atomic everywhere via `safeWriteFile` rather than direct `writeFileSync`?
