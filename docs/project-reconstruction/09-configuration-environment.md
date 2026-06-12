# 09 - Configuration and Environment Variables

Generated from repository state on 2026-06-12. No secrets are included; environment-variable names are documented without values.

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
appId: com.antman.hermes-desktop-max
productName: Hermes Desktop Max
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
  executableName: hermes-desktop-max
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
  artifactName: hermes-desktop-max-${version}-${arch}-${os}.${ext}
  icon: build/icon.icns
  identity: null
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.inherit.plist
  extendInfo:
    NSCameraUsageDescription: Application requests access to the device's camera.
    NSMicrophoneUsageDescription: Application requests access to the device's microphone.
    NSDocumentsFolderUsageDescription: Application requests access to the user's Documents folder.
    NSDownloadsFolderUsageDescription: Application requests access to the user's Downloads folder.
  hardenedRuntime: false
  gatekeeperAssess: false
  notarize: false
dmg:
  artifactName: hermes-desktop-max-${version}-${arch}.${ext}
linux:
  target:
    - AppImage
    - snap
    - deb
    - rpm
  maintainer: electronjs.org
  vendor: Antman
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
afterPack: build/afterPack.js
publish:
  provider: github
  owner: Antman1526
  repo: hermes-desktop-Max
```

## Desktop Connection Config Shape

```ts
  17 |
  18 | export interface SshConnectionConfig {
  19 |   host: string;
  20 |   port: number;
  21 |   username: string;
  22 |   keyPath: string;
  23 |   remotePort: number;
  24 |   localPort: number;
  25 | }
  26 |
  27 | export interface ConnectionConfig {
  28 |   mode: "local" | "remote" | "ssh";
  29 |   remoteUrl: string;
  30 |   apiKey: string;
  31 |   ssh: SshConnectionConfig;
  32 | }
  33 |
  34 | export interface PublicConnectionConfig {
  35 |   mode: "local" | "remote" | "ssh";
  36 |   remoteUrl: string;
  37 |   hasApiKey: boolean;
  38 |   // Length of the stored API key, exposed so the renderer can show a
  39 |   // mask that matches the real value's width. The secret itself never
  40 |   // leaves the main process. 0 when no key is set.
  41 |   apiKeyLength: number;
  42 |   ssh: SshConnectionConfig;
  43 | }
  44 |
  45 | // Lazy getter — avoids circular dependency with installer.ts
  46 | // (HERMES_HOME may not be assigned yet when this module first loads)
  47 | function desktopConfigFile(): string {
  48 |   return join(HERMES_HOME, "desktop.json");
  49 | }
  50 |
  51 | export function readDesktopConfig(): Record<string, unknown> {
  52 |   try {
  53 |     const f = desktopConfigFile();
  54 |     if (!existsSync(f)) return {};
  55 |     return JSON.parse(readFileSync(f, "utf-8"));
  56 |   } catch {
  57 |     return {};
  58 |   }
  59 | }
  60 |
  61 | export function writeDesktopConfig(data: Record<string, unknown>): void {
  62 |   if (!existsSync(HERMES_HOME)) {
  63 |     mkdirSync(HERMES_HOME, { recursive: true });
  64 |   }
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
 114 |       keyPath: (ssh.keyPath as string) || "",
 115 |       remotePort: (ssh.remotePort as number) || 8642,
 116 |       localPort: (ssh.localPort as number) || 18642,
 117 |     },
 118 |   };
 119 | }
 120 |
 121 | export function getPublicConnectionConfig(): PublicConnectionConfig {
 122 |   const config = getConnectionConfig();
 123 |   return {
 124 |     mode: config.mode,
 125 |     remoteUrl: config.remoteUrl,
 126 |     hasApiKey: config.apiKey.length > 0,
 127 |     apiKeyLength: config.apiKey.length,
 128 |     ssh: config.ssh,
 129 |   };
 130 | }
 131 |
 132 | export function setConnectionConfig(config: ConnectionConfig): void {
 133 |   const data = readDesktopConfig();
 134 |   data.connectionMode = config.mode;
 135 |   data.remoteUrl = config.remoteUrl;
 136 |   data.remoteApiKey = config.apiKey;
 137 |   if (config.mode === "ssh") {
 138 |     data.sshConfig = config.ssh;
 139 |   }
 140 |   writeDesktopConfig(data);
 141 | }
 142 |
 143 | export function resolveConnectionApiKeyUpdate(
 144 |   existing: ConnectionConfig,
 145 |   mode: "local" | "remote" | "ssh",
 146 |   remoteUrl: string,
 147 |   apiKey?: string,
 148 | ): string {
 149 |   if (apiKey !== undefined) return apiKey;
 150 |   if (existing.mode === mode && existing.remoteUrl === remoteUrl) {
 151 |     return existing.apiKey;
 152 |   }
 153 |   return "";
 154 | }
 155 |
 156 | // ── In-memory cache with TTL ─────────────────────────────
 157 | const CACHE_TTL = 5000; // 5 seconds
 158 | const _cache = new Map<string, { data: unknown; ts: number }>();
 159 | const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
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

## Areas for Review

- Should environment-variable definitions be generated from one shared provider registry?
- Should the desktop store user-facing config in a versioned file with migrations?
- Should config writes be atomic everywhere via `safeWriteFile` rather than direct `writeFileSync`?
