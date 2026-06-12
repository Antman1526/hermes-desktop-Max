/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const docsDir = join(root, "docs", "project-reconstruction");
mkdirSync(docsDir, { recursive: true });

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const builder = readFileSync(join(root, "electron-builder.yml"), "utf8").trim();
const vite = readFileSync(join(root, "electron.vite.config.ts"), "utf8").trim();
const vitest = readFileSync(join(root, "vitest.config.ts"), "utf8").trim();
const eslint = readFileSync(join(root, "eslint.config.mjs"), "utf8").trim();
const generatedOn = new Date().toISOString().slice(0, 10);

function ensureDir(file) {
  mkdirSync(dirname(file), { recursive: true });
}

function writeDoc(name, body) {
  const file = join(docsDir, name);
  ensureDir(file);
  writeFileSync(file, body.trim() + "\n", "utf8");
}

function code(path, start = 1, end = start + 60) {
  const abs = join(root, path);
  if (!existsSync(abs)) return `// Missing source file: ${path}`;
  const lines = readFileSync(abs, "utf8").split(/\r?\n/);
  return lines
    .slice(start - 1, end)
    .map((line, index) =>
      line.length > 0
        ? `${String(start + index).padStart(4, " ")} | ${line}`
        : `${String(start + index).padStart(4, " ")} |`,
    )
    .join("\n");
}

function block(lang, text) {
  return "```" + lang + "\n" + text.trimEnd() + "\n```";
}

function listObject(obj) {
  return Object.entries(obj)
    .map(([name, version]) => `- \`${name}\` - \`${version}\``)
    .join("\n");
}

function title(n, text) {
  return `# ${String(n).padStart(2, "0")} - ${text}\n\nGenerated from repository state on ${generatedOn}. No secrets are included; environment-variable names are documented without values.`;
}

const dependencyList = listObject(pkg.dependencies);
const devDependencyList = listObject(pkg.devDependencies);
const setupCommandsBlock = block(
  "bash",
  ["npm install", "npm run typecheck", "npm test", "npm run dev"].join("\n"),
);
const savedModelJsonBlock = block(
  "json",
  [
    "[",
    "  {",
    '    "id": "local-file-<sha1-16>",',
    '    "name": "Local Qwen 7B",',
    '    "provider": "custom",',
    '    "model": "/Users/Antman/Desktop/AI_Models/Qwen-7B.gguf",',
    '    "baseUrl": "http://localhost:8080/v1",',
    '    "source": "local-file",',
    '    "modelPath": "/Users/Antman/Desktop/AI_Models/Qwen-7B.gguf",',
    '    "modelFormat": "gguf",',
    '    "launchable": true,',
    '    "createdAt": 1760000000000',
    "  }",
    "]",
  ].join("\n"),
);
const sessionCacheJsonBlock = block(
  "json",
  [
    "{",
    '  "sessions": [',
    "    {",
    '      "id": "session-id",',
    '      "title": "First user message summary",',
    '      "startedAt": 1760000000,',
    '      "source": "desktop",',
    '      "messageCount": 12,',
    '      "model": "openrouter/auto"',
    "    }",
    "  ],",
    '  "lastSync": 1760000000',
    "}",
  ].join("\n"),
);
const chatResponseTypeBlock = block(
  "ts",
  [
    "type ChatResponse = {",
    "  response: string;",
    "  sessionId?: string;",
    "};",
  ].join("\n"),
);
const testCommandsBlock = block(
  "bash",
  ["npm run typecheck", "npm test", "npm run lint"].join("\n"),
);
const releaseVerificationBlock = block(
  "bash",
  [
    "npm run build",
    "CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac dmg --arm64 --publish never -c.mac.notarize=false",
    "CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win nsis --x64 --publish never",
  ].join("\n"),
);
const unsignedBuildBlock = block(
  "bash",
  [
    "CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac dmg --arm64 --publish never -c.mac.notarize=false",
    "CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win nsis --x64 --publish never",
  ].join("\n"),
);
const topLevelTreeBlock = block(
  "text",
  [
    ".",
    "├── build/                    # icons, entitlements, Linux hooks, winget templates",
    "├── changelogs/               # release notes",
    "├── docs/                     # technical docs and superpowers plans/specs",
    "├── previews/                 # README screenshots and header images",
    "├── resources/                # Electron app resources",
    "├── scripts/                  # release/debug/e2e helper scripts",
    "├── src/",
    "│   ├── main/                 # privileged Electron main process modules",
    "│   ├── preload/              # contextBridge API declarations and preload bundles",
    "│   ├── renderer/             # React app",
    "│   └── shared/               # shared attachment and i18n logic",
    "└── tests/                    # main/shared unit tests",
  ].join("\n"),
);
const chatTreeBlock = block(
  "text",
  [
    "src/renderer/src/screens/Chat/",
    "├── Chat.tsx",
    "├── ChatInput.tsx",
    "├── ChatHeader.tsx",
    "├── MessageList.tsx",
    "├── MessageRow.tsx",
    "├── ModelPicker.tsx",
    "├── WorktreePanel.tsx",
    "├── hooks/",
    "│   ├── useChatActions.ts",
    "│   ├── useChatIPC.ts",
    "│   ├── useModelConfig.ts",
    "│   └── ...",
    "└── utilities and tests",
  ].join("\n"),
);

const files = [
  "01-project-overview-architecture.md",
  "02-environment-setup-dependencies.md",
  "03-database-schema-data-models.md",
  "04-backend-api-specifications.md",
  "05-frontend-architecture-components.md",
  "06-authentication-authorization.md",
  "07-business-logic-core-algorithms.md",
  "08-integrations-external-services.md",
  "09-configuration-environment.md",
  "10-testing-strategy-test-cases.md",
  "11-build-deployment-pipeline.md",
  "12-error-handling-logging.md",
  "13-performance-caching-optimization.md",
  "14-security-implementation-best-practices.md",
  "15-file-structure-code-organization.md",
];

writeDoc(
  files[0],
  `${title(1, "Project Overview and Architecture")}

## Purpose

Hermes Desktop is an Electron desktop shell for installing, configuring, and operating Nous Research Hermes Agent. It wraps a local or remote Hermes API server with a React UI for chat, model selection, profiles, memory, skills, tools, schedules, gateways, Office/Claw3d, Paperclip, and diagnostics. This fork is version \`${pkg.version}\` and adds practical local model file discovery for:

- \`/Volumes/MainStore/Development/AI_Models\`
- \`/Users/Antman/Desktop/AI_Models\`

It also includes Windows-oriented runtime path handling, Paperclip sidecar controls, OpenChronicle memory-provider wiring, tighter installer packaging rules, and a local \`llama-server\` launcher for discovered \`.gguf\` model files.

## Runtime Topology

The application has four major runtime layers:

1. **Main process** - Electron lifecycle, BrowserWindow creation, IPC handlers, file-system access, subprocess orchestration, SQLite reads, updater control, and shell integration.
2. **Preload bridge** - exposes a typed \`window.hermesAPI\` and \`window.electron\` API to the renderer using \`contextBridge\` while keeping Node APIs out of the renderer.
3. **Renderer** - React 19 UI rendered by Vite. Screens use \`window.hermesAPI\` for all privileged operations.
4. **Hermes Agent backend** - local process under \`HERMES_HOME\` or a remote/SSH URL. Chat uses OpenAI-compatible HTTP/SSE endpoints.

## Architecture Diagram

\`\`\`mermaid
flowchart LR
  User["User"] --> Renderer["React renderer"]
  Renderer --> Preload["contextBridge preload"]
  Preload --> Main["Electron main process"]
  Main --> Hermes["Hermes Agent API server"]
  Main --> StateDb["state.db via better-sqlite3"]
  Main --> Config["~/.hermes config, env, profiles"]
  Main --> LocalModels["Local GGUF/Safetensors folders"]
  Main --> Paperclip["Paperclip sidecar"]
  Main --> Claw3d["Hermes Office / Claw3d"]
  Hermes --> Providers["LLM providers and tools"]
\`\`\`

## Main Process Composition

The main process imports each domain module and registers IPC handlers centrally in \`src/main/index.ts\`. That is intentionally simple to trace, but it makes the file large and creates a high-change hot spot.

${block("ts", code("src/main/index.ts", 1, 80))}

## App Window and Navigation Boundary

The Electron window is configured in the main process and protected by URL allowlists from \`src/main/security.ts\`. In development the renderer is loaded from \`ELECTRON_RENDERER_URL\`; in production it loads the built \`out/renderer/index.html\`.

${block("ts", code("src/main/index.ts", 300, 360))}

## Main Design Decisions

- **Electron instead of a pure web app:** required because the app installs local tooling, manages child processes, reads local SQLite databases, stages attachments, launches local model servers, and signs/updates desktop packages.
- **Single IPC facade:** renderer code talks to \`window.hermesAPI\` rather than importing Electron or Node. This keeps UI code portable and keeps privileged effects auditable in main/preload.
- **Hermes-owned persistent state:** the desktop app stores desktop-specific state in \`~/.hermes/desktop.json\`, \`~/.hermes/models.json\`, profile folders, and \`~/.hermes/desktop/sessions.json\`. Conversation data remains in Hermes Agent's \`state.db\`.
- **OpenAI-compatible routing:** local/custom providers are normalized into \`OPENAI_BASE_URL\` and a resolved API key so Hermes Agent can use the OpenAI-compatible path.
- **Generated installers:** electron-builder is configured for macOS DMG, Windows NSIS/portable, Linux AppImage/Snap/Deb/RPM, and GitHub publishing.

## Rebuild Requirements

To recreate this project, implement:

- Electron main/preload/renderer build split with \`electron-vite\`.
- React screen modules under \`src/renderer/src/screens\`.
- Typed preload API matching \`src/preload/index.ts\` and ambient declarations in \`src/preload/index.d.ts\`.
- Hermes install, gateway, SSH, profile, memory, skill, model, session, scheduling, Paperclip, and Claw3d modules in \`src/main\`.
- Test coverage with Vitest/jsdom and explicit main-process unit tests.

## Areas for Review

- Should \`src/main/index.ts\` be split into per-domain IPC registration files to reduce merge conflicts and startup complexity?
- Should local model discovery support user-configurable roots instead of hard-coded fork-specific paths?
- Should the app introduce a schema layer for \`desktop.json\`, \`models.json\`, and profile config mutations?
`,
);

writeDoc(
  files[1],
  `${title(2, "Environment Setup and Dependencies")}

## Toolchain

Required tools:

- Node.js 22-compatible runtime recommended because \`@types/node\` targets 22 and Electron 39 bundles modern Node.
- npm, using \`package-lock.json\` lockfile version 3.
- Git for repository operations and Hermes Agent install/update flows.
- Python 3.11+ and \`uv\` for Hermes Agent local install flows.
- Electron-compatible build hosts: macOS for DMG signing/notarization, Windows or cross-build tooling for NSIS, Linux for native Linux packages.

## Install Commands

${setupCommandsBlock}

Development starts the Electron/Vite dev runtime. A fresh isolated Hermes home can be used with:

${block("bash", pkg.scripts["dev:fresh"])}

## Runtime Dependencies

${dependencyList}

## Development Dependencies

${devDependencyList}

## Build Configuration

Electron Vite defines separate bundles for main, preload, and renderer. The \`better-sqlite3\` native module is externalized from the main Rollup bundle so it can remain a runtime native dependency.

${block("ts", vite)}

## Test Configuration

Vitest runs jsdom for renderer tests, aliases \`@renderer\` and \`@shared\`, and includes both colocated renderer tests and top-level main tests.

${block("ts", vitest)}

## Lint and Formatting

ESLint combines Electron Toolkit TypeScript rules, React rules, React Hooks rules, Vite refresh rules, and Prettier compatibility.

${block("js", eslint)}

## Environment Setup Steps

1. Clone \`https://github.com/Antman1526/hermes-desktop-Max.git\`.
2. Run \`npm install\`.
3. Copy \`.env.example\` only if enabling analytics; do not commit real env files.
4. Run \`npm run typecheck\` and \`npm test\`.
5. Run \`npm run dev\`.
6. On first launch, select local, remote, or SSH connection mode.

## Edge Cases

- Native module rebuilds can fail if Electron headers are missing. \`postinstall\` runs \`electron-builder install-app-deps\`.
- macOS DMG notarization requires Apple credentials; local unsigned builds must override notarization/signing.
- Windows native install paths require \`venv/Scripts/python.exe\` style paths; WSL remains safer for Unix-heavy Hermes Agent scripts.
`,
);

writeDoc(
  files[2],
  `${title(3, "Database Schema and Data Models")}

## Persistent Stores

Hermes Desktop uses a mixed persistence model:

- \`state.db\` - Hermes Agent SQLite database, read by desktop for sessions and messages.
- \`desktop/sessions.json\` - desktop cache of session summaries per profile.
- \`models.json\` - saved model entries, including local-file entries.
- \`desktop.json\` - desktop connection, Paperclip, SSH, and other UI-level preferences.
- \`.env\`, \`config.yaml\`, \`SOUL.md\`, \`auth.json\` - Hermes Agent/profile files.

## SQLite Tables Inferred from Desktop Queries

The desktop does not own migrations for Hermes Agent \`state.db\`, but it depends on these tables and columns:

### \`sessions\`

| Column | Type | Used by |
| --- | --- | --- |
| \`id\` | text | session key |
| \`source\` | text | source label |
| \`started_at\` | integer epoch seconds | sorting and cache sync |
| \`ended_at\` | integer/null | session summary |
| \`message_count\` | integer | session count and cache refresh |
| \`model\` | text | UI model label |
| \`title\` | text/null | session title |

### \`messages\`

| Column | Type | Used by |
| --- | --- | --- |
| \`id\` | integer | message identity |
| \`session_id\` | text | session relationship |
| \`role\` | text | user/assistant/tool |
| \`content\` | text | text or sentinel-prefixed JSON multimodal content |
| \`timestamp\` | integer | timeline sorting |

### \`messages_fts\`

FTS5 virtual table used for session search. Desktop checks for table existence before querying.

## Session Data Access

${block("ts", code("src/main/sessions.ts", 130, 230))}

## Multimodal Message Decoding

Hermes Agent stores multimodal message content with a sentinel prefix \`\\x00json:\`. Desktop decodes text and image parts into renderer attachments.

${block("ts", code("src/main/sessions.ts", 70, 128))}

## Session Cache Model

The session cache is profile-scoped. Default profile cache lives under \`~/.hermes/desktop/sessions.json\`; named profiles use \`~/.hermes/profiles/<name>/desktop/sessions.json\`.

${block("ts", code("src/main/session-cache.ts", 1, 90))}

## Saved Model Model

\`SavedModel\` is the canonical desktop-side model record. Local file entries carry \`source: "local-file"\`, \`modelPath\`, \`modelFormat\`, and \`launchable\`.

${block("ts", code("src/main/models.ts", 1, 45))}

## JSON Schemas to Recreate

### \`models.json\`

${savedModelJsonBlock}

### \`desktop/sessions.json\`

${sessionCacheJsonBlock}

## Areas for Review

- Should SQLite access be wrapped in repository classes to make table dependencies explicit?
- Should JSON files use Zod or JSON Schema validation before writes?
- Should session cache writes include pretty JSON for debuggability or compact JSON for speed?
`,
);

writeDoc(
  files[3],
  `${title(4, "Backend API Specifications")}

## API Surface

Hermes Desktop exposes backend operations through Electron IPC, not a public HTTP server. The renderer calls methods on \`window.hermesAPI\`; preload translates them into \`ipcRenderer.invoke(channel, ...args)\`; main handles each channel with \`ipcMain.handle\`.

## Preload Bridge Pattern

${block("ts", code("src/preload/index.ts", 35, 90))}

## Main IPC Registration Pattern

${block("ts", code("src/main/index.ts", 407, 470))}

## Domain API Groups

### Installation

| Renderer method | IPC channel | Purpose |
| --- | --- | --- |
| \`checkInstall()\` | \`check-install\` | returns installed/configured/API-key status |
| \`verifyInstall()\` | \`verify-install\` | validates Hermes installation |
| \`startInstall()\` | \`start-install\` | runs installer and emits progress |
| \`inspectInstallTarget()\` | \`inspect-install-target\` | classifies install target as fresh/update/replace |
| \`adoptHermesHome(dir)\` | \`adopt-hermes-home\` | persists selected Hermes home override |

### Chat

\`sendMessage(message, profile, resumeSessionId, history, attachments, contextFolder)\` invokes \`send-message\`. The main handler ensures local/SSH backend readiness and delegates to \`sendMessage\` in \`src/main/hermes.ts\`.

Expected response:

${chatResponseTypeBlock}

### Models

| Renderer method | IPC channel | Purpose |
| --- | --- | --- |
| \`listModels()\` | \`list-models\` | reads defaults, custom providers, and local model files |
| \`addModel(name, provider, model, baseUrl)\` | \`add-model\` | appends a model if not duplicate |
| \`removeModel(id)\` | \`remove-model\` | removes a saved model |
| \`updateModel(id, fields)\` | \`update-model\` | partial update |
| \`localModelServerStatus()\` | \`local-model-server-status\` | returns \`llama-server\` state |
| \`startLocalModelServer(modelPath)\` | \`start-local-model-server\` | launches discovered GGUF file |
| \`stopLocalModelServer()\` | \`stop-local-model-server\` | terminates managed server |

### Session and Cache

| Channel | Return |
| --- | --- |
| \`list-sessions\` | \`SessionSummary[]\` |
| \`get-session-messages\` | visible and timeline history items |
| \`search-sessions\` | \`SearchResult[]\` from FTS |
| \`sync-session-cache\` | cache summaries |
| \`list-cached-sessions\` | paged cache summaries |

### Paperclip

\`get-paperclip-config\`, \`set-paperclip-config\`, \`paperclip-status\`, \`start-paperclip\`, \`stop-paperclip\`, and \`open-paperclip\` manage a sidecar service at \`http://127.0.0.1:3100\` by default.

## HTTP Backend Contract to Hermes Agent

Local mode defaults to \`http://127.0.0.1:8642\`. Remote and SSH modes normalize configured URLs so callers append \`/v1/...\` exactly once.

${block("ts", code("src/main/hermes.ts", 35, 90))}

## Streaming Protocol

Chat uses Server-Sent Events compatible with OpenAI-style chat completions. The desktop parses text deltas, reasoning deltas, tool calls, tool results, token/cost metadata, and final session IDs. Abort is implemented through a main-process chat handle.

## Error Shapes

Most IPC handlers return one of:

- \`boolean\` success/failure.
- \`{ success: boolean; error?: string }\`.
- Domain object with optional \`error\` field, for example local model server status.

## Areas for Review

- Should IPC channels be described with generated TypeScript contracts and runtime validators?
- Should all handlers standardize on \`Result<T, ErrorCode>\` instead of mixed booleans and throw/catch?
- Should long-running tasks stream structured progress events rather than text chunks?
`,
);

writeDoc(
  files[4],
  `${title(5, "Frontend Architecture and Components")}

## Renderer Stack

The renderer is a React 19 + Vite application. Tailwind CSS is loaded through the Vite plugin, with app styles under \`src/renderer/src/assets\`. Routing is screen/state based inside the React tree rather than a browser router.

## Entry Points

${block("tsx", code("src/renderer/src/main.tsx", 1, 120))}

${block("tsx", code("src/renderer/src/App.tsx", 1, 160))}

## Screen Inventory

- \`Chat\` - streaming chat workspace, message history, model selection, attachments, slash commands.
- \`Sessions\` - cached and DB-backed session browsing/search.
- \`Agents\` - profile management.
- \`Skills\` - bundled/installed/imported skill management.
- \`Models\` - provider and saved model CRUD.
- \`Memory\` - memory entries, user profile, provider discovery/configuration.
- \`Soul\` - persona editor.
- \`Tools\` - toolset toggles.
- \`Schedules\` - cron job builder.
- \`Gateway\` - messaging platform configuration.
- \`Office\` - Claw3d dev server/adapter management.
- \`Paperclip\` - Paperclip sidecar configuration and dashboard launch.
- \`Settings\` - network mode, backup/import, logs, diagnostics, updates, credentials.

## Chat Composition

Chat is decomposed into display components, input components, hooks, and utilities:

- \`Chat.tsx\` coordinates state and flow.
- \`ChatInput.tsx\` manages text, attachments, slash commands, and keyboard actions.
- \`MessageList.tsx\` and \`MessageRow.tsx\` render transcript items.
- \`ModelPicker.tsx\` selects provider/model and triggers local server startup for launchable models.
- \`useChatIPC.ts\` wraps main-process chat calls.
- \`useModelConfig.ts\` loads/saves model config.

Representative hook:

${block("tsx", code("src/renderer/src/screens/Chat/hooks/useModelConfig.ts", 1, 140))}

## Paperclip Screen Pattern

The Paperclip screen is a compact example of renderer to IPC flow: load status/config, edit URL/telemetry state, start/stop sidecar, and open dashboard through main.

${block("tsx", code("src/renderer/src/screens/Paperclip/Paperclip.tsx", 1, 130))}

## Internationalization

\`src/shared/i18n\` provides locale typing and translation helpers. English is the primary locale, with additional locale files under \`src/shared/i18n/locales\`. Renderer components use \`I18nProvider\`, \`useI18n\`, and shared locale keys.

## State Management

The project uses React state and hooks instead of Redux/Zustand. Most durable state is loaded through \`window.hermesAPI\` and stored in local component state. This keeps state localized, but cross-screen settings can cause repeated loading and implicit coupling through files.

## Areas for Review

- Would a typed query/cache layer reduce duplicate loading logic across screens?
- Should screen-level state be colocated into domain hooks that mirror main modules?
- Are the large screens candidates for reducer-based state machines to make async transitions easier to test?
`,
);

writeDoc(
  files[5],
  `${title(6, "Authentication and Authorization System")}

## Trust Boundaries

Authentication is split across three boundaries:

1. **Desktop to Hermes API server** - local mode may use a generated \`API_SERVER_KEY\`; remote mode stores an API key in \`desktop.json\`; SSH mode caches the remote API key after tunnel setup.
2. **Hermes Agent to model/tools providers** - provider API keys live in profile \`.env\` files and are passed to subprocesses or HTTP calls.
3. **OAuth/device-code providers** - login is mediated by the main process through Hermes CLI commands, with progress streamed to renderer.

## Public Connection Config Avoids Secret Leakage

The renderer receives \`hasApiKey\` and \`apiKeyLength\`, not the actual remote API key.

${block("ts", code("src/main/config.ts", 65, 90))}

## API Server Key Handling

Main exposes \`get-api-server-key-status\` and \`generate-api-server-key\`. The key is generated in main, stored in the active profile environment, and not returned except at generation time for user copy/display.

${block("ts", code("src/main/index.ts", 647, 674))}

## Remote Authorization Header

${block("ts", code("src/main/hermes.ts", 91, 127))}

## Provider Key Resolution

Provider keys are inferred from provider IDs and base URL patterns. Local/custom endpoints use \`OPENAI_BASE_URL\` with a resolved key or \`no-key-required\` for local no-auth endpoints.

${block("ts", code("src/main/hermes.ts", 151, 184))}

## OAuth Flow

\`src/main/hermes-auth.ts\` starts Hermes CLI OAuth login, detects provider device-code output, streams progress chunks, and supports cancellation. Renderer never gets raw child process handles.

## Authorization Model

There is no multi-user authorization system inside the desktop app. Access control is local-machine based: whoever can run the desktop process can access local Hermes files, profiles, and configured provider keys. Remote mode relies on bearer token API keys.

## Edge Cases

- If the user switches remote URLs without passing an API key, \`resolveConnectionApiKeyUpdate\` clears the old key to avoid sending it to a different host.
- SSH mode requires tunnel health before chat; if tunnel is down, main restarts it.
- Provider key writes that affect a running gateway can trigger a targeted gateway restart.

## Areas for Review

- Should secrets move from JSON/env files into OS keychain storage?
- Should remote API keys be redacted from logs and error payloads with a shared sanitizer?
- Should the renderer receive one-time display tokens only through a modal lifecycle rather than direct return values?
`,
);

writeDoc(
  files[6],
  `${title(7, "Business Logic and Core Algorithms")}

## Install and Runtime Orchestration

The installer module resolves \`HERMES_HOME\`, Hermes repo path, Python path, enhanced PATH, install target state, API key mappings, memory providers, backups, imports, doctor, update, and log reading. It is the main compatibility layer between Electron and Hermes Agent.

## Chat Routing Algorithm

1. Resolve active connection mode: local, remote, or SSH.
2. Normalize the base URL, stripping trailing slashes and duplicate \`/v1\`.
3. Ensure SSH tunnel is active when required.
4. Read active model config and provider env.
5. For OpenAI-compatible providers, set \`OPENAI_BASE_URL\` and matching key.
6. Prefer HTTP streaming fast path when API server is ready.
7. Fall back to Hermes CLI spawning when necessary.

URL normalization:

${block("ts", code("src/main/hermes.ts", 35, 53))}

## Local Model Discovery Algorithm

The fork scans the two configured roots recursively, ignores macOS AppleDouble \`._\` files, accepts \`.gguf\` and \`.safetensors\`, and converts each file into a deterministic saved model entry. GGUF files are launchable through \`llama-server\`; safetensors files are discoverable but not directly launched.

${block("ts", code("src/main/local-model-files.ts", 1, 78))}

## Local Model Server Algorithm

The launcher only starts a \`.gguf\` file that was discovered under the configured roots. It writes PID, model, port, and log state files under \`HERMES_HOME\`, starts at port \`8080\`, searches through \`8099\`, checks health at \`http://127.0.0.1:<port>/v1/models\`, and uses \`llama-server\` from Homebrew, \`/usr/local/bin\`, or PATH.

${block("ts", code("src/main/local-model-server.ts", 126, 209))}

## Session Cache Algorithm

Session sync uses a last-sync window, O(1) Map merges, and chunked stale count refresh to avoid O(N2) behavior with large histories.

${block("ts", code("src/main/session-cache.ts", 82, 190))}

## Paperclip Sidecar Algorithm

Paperclip config normalizes URLs, validates health, checks \`paperclipai\` or \`npx\`, and starts \`npx paperclipai run\` with telemetry disabled by default.

${block("ts", code("src/main/paperclip.ts", 46, 120))}

## YAML Path Logic

\`src/main/config.ts\` contains dotted YAML path readers/writers that avoid flat-key leaks and restrict environment variable names. This is critical because renderer UI writes paths such as \`agent.service_tier\` and \`memory.provider\`.

## Areas for Review

- Should local model scanning be asynchronous with cancellation to avoid blocking startup on very large model folders?
- Should child-process lifecycle management be centralized for gateway, local model server, Paperclip, Claw3d, and install tasks?
- Should provider key resolution be data-driven from \`constants.ts\` instead of duplicated in renderer/main?
`,
);

writeDoc(
  files[7],
  `${title(8, "Integration Points and External Services")}

## Hermes Agent

Hermes Agent is the primary backend. The desktop installs it into \`HERMES_HOME\`, starts/stops its API gateway, runs CLI commands, reads \`state.db\`, and edits \`.env\` / \`config.yaml\` / \`SOUL.md\`.

## Model Providers

The UI and main process know these provider families:

- OpenRouter, Anthropic, OpenAI, Google Gemini, xAI, Nous Portal, Qwen, MiniMax, Hugging Face.
- OpenAI-compatible hosted APIs: Groq, DeepSeek, Together, Fireworks, Cerebras, Mistral, Perplexity.
- Local/custom endpoints: LM Studio, Atomic Chat, Ollama, vLLM, llama.cpp, Docker Model Runner, any custom OpenAI-compatible URL.
- Local model files: GGUF and safetensors in the configured desktop folders.

Provider constants and env-key mappings live in \`src/renderer/src/constants.ts\` and are mirrored in main installer/chat logic.

## Messaging Gateways

Supported platform settings include Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, Email, SMS/Twilio/Vonage, iMessage/BlueBubbles, DingTalk, Feishu/Lark, WeCom, WeChat/iLink Bot, Webhooks, and Home Assistant.

## Memory Providers

Built-in memory editing is file/config based. External memory providers include Honcho, Hindsight, Mem0, RetainDB, Supermemory, OpenViking, ByteRover, and OpenChronicle. Provider discovery and configuration are exposed through \`discover-memory-providers\` and \`configure-memory-provider\`.

## Paperclip

Paperclip is managed as a sidecar at \`http://127.0.0.1:3100\` by default.

${block("ts", code("src/main/paperclip.ts", 1, 45))}

## Hermes Office / Claw3d

\`src/main/claw3d.ts\` manages a dev server, adapter process, port file, websocket URL file, gateway token propagation, and log/status APIs. The UI screen starts/stops all parts as an integrated Office workflow.

## SSH Remote Mode

SSH mode combines SSH command execution with a local tunnel. It lets the UI use the same renderer APIs while main proxies reads/writes and API calls to a remote Hermes install.

## Analytics

PostHog is optional and renderer-only. \`.env.example\` documents \`VITE_POSTHOG_KEY\` and \`VITE_POSTHOG_HOST\`; analytics are inert without a key.

## Areas for Review

- Can provider metadata be consolidated into one shared registry consumed by renderer and main?
- Should integration health checks share one timeout/retry policy?
- Should external services be grouped into capability packs so unavailable services do not clutter first-run setup?
`,
);

writeDoc(
  files[8],
  `${title(9, "Configuration and Environment Variables")}

## Configuration Files

| File | Owner | Purpose |
| --- | --- | --- |
| \`package.json\` | repo | scripts, dependencies, app version |
| \`electron-builder.yml\` | repo | packaging targets, app ID, artifacts |
| \`electron.vite.config.ts\` | repo | main/preload/renderer build split |
| \`vitest.config.ts\` | repo | test runner config |
| \`.env.example\` | repo | optional renderer analytics variables |
| \`~/.hermes/desktop.json\` | desktop | connection mode, remote URL/key, SSH, Paperclip |
| \`~/.hermes/.env\` | Hermes profile | provider/tool/gateway secrets |
| \`~/.hermes/config.yaml\` | Hermes profile | Hermes Agent runtime config |
| \`~/.hermes/models.json\` | desktop | saved model library |

## Electron Builder Configuration

${block("yaml", builder)}

## Desktop Connection Config Shape

${block("ts", code("src/main/config.ts", 17, 64))}

## Environment Variable Categories

### Desktop build/runtime

- \`ELECTRON_RENDERER_URL\` - dev renderer URL.
- \`ENABLE_CDP=1\` and \`CDP_PORT\` - optional Chrome DevTools Protocol port for debugging.
- \`PORTABLE_EXECUTABLE_DIR\` - portable Windows build detection.
- \`HERMES_HOME\` - optional override for Hermes data root.
- \`VITE_POSTHOG_KEY\`, \`VITE_POSTHOG_HOST\` - optional analytics.

### Model providers

\`OPENROUTER_API_KEY\`, \`ANTHROPIC_API_KEY\`, \`OPENAI_API_KEY\`, \`GOOGLE_API_KEY\`, \`XAI_API_KEY\`, \`GROQ_API_KEY\`, \`DEEPSEEK_API_KEY\`, \`TOGETHER_API_KEY\`, \`FIREWORKS_API_KEY\`, \`CEREBRAS_API_KEY\`, \`MISTRAL_API_KEY\`, \`PERPLEXITY_API_KEY\`, \`HF_TOKEN\`, \`QWEN_API_KEY\`, \`MINIMAX_API_KEY\`, \`GLM_API_KEY\`, \`KIMI_API_KEY\`, \`NVIDIA_API_KEY\`, \`CUSTOM_API_KEY\`.

### Tools and services

\`EXA_API_KEY\`, \`PARALLEL_API_KEY\`, \`TAVILY_API_KEY\`, \`FIRECRAWL_API_KEY\`, \`HONCHO_API_KEY\`, \`BROWSERBASE_API_KEY\`, \`VOICE_TOOLS_OPENAI_KEY\`, \`TINKER_API_KEY\`, \`WANDB_API_KEY\`.

### Messaging

\`TELEGRAM_BOT_TOKEN\`, \`DISCORD_BOT_TOKEN\`, \`SLACK_BOT_TOKEN\`, \`SLACK_APP_TOKEN\`, \`WHATSAPP_API_TOKEN\`, \`MATRIX_ACCESS_TOKEN\`, \`MATTERMOST_TOKEN\`, \`TWILIO_AUTH_TOKEN\`, \`WEIXIN_BOT_TOKEN\`, \`HASS_TOKEN\`.

## Config Mutation Rules

Environment keys must match \`/^[A-Za-z_][A-Za-z0-9_]*$/\` and values must be single-line strings.

${block("ts", code("src/main/config.ts", 114, 178))}

## Areas for Review

- Should environment-variable definitions be generated from one shared provider registry?
- Should the desktop store user-facing config in a versioned file with migrations?
- Should config writes be atomic everywhere via \`safeWriteFile\` rather than direct \`writeFileSync\`?
`,
);

writeDoc(
  files[9],
  `${title(10, "Testing Strategy and Test Cases")}

## Test Runner

Tests use Vitest 4 with jsdom, globals, and renderer setup file. Main-process tests mock filesystem/process/Electron boundaries where possible.

${block("ts", vitest)}

## Test Coverage Areas

Top-level \`tests/\` covers:

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

${block("ts", code("tests/local-model-files.test.ts", 1, 140))}

Paperclip tests validate URL normalization and sidecar behavior:

${block("ts", code("tests/paperclip.test.ts", 1, 160))}

Security tests validate allowed URLs and webview hardening:

${block("ts", code("tests/electron-security.test.ts", 1, 160))}

## Verification Commands

${testCommandsBlock}

For release builds:

${releaseVerificationBlock}

## Test Data Principles

- Use temp directories for filesystem tests.
- Mock child processes instead of launching real Hermes/Paperclip/llama-server.
- Assert security-negative cases, not only allowed cases.
- Assert exact IPC surface so preload/main drift is caught.

## Areas for Review

- Should the project add Playwright/Electron smoke tests for the packaged app?
- Should local model server tests cover health-check races and stale PID files more deeply?
- Should package-build tests verify \`electron-builder.yml\` excludes docs/tests/scripts from packaged artifacts?
`,
);

writeDoc(
  files[10],
  `${title(11, "Build and Deployment Pipeline")}

## Build Scripts

${block("json", JSON.stringify(pkg.scripts, null, 2))}

## Build Flow

1. \`npm run typecheck\` validates main/preload and renderer TypeScript projects.
2. \`electron-vite build\` emits \`out/main\`, \`out/preload\`, and \`out/renderer\`.
3. \`electron-builder\` packages the app by platform.
4. Native modules such as \`better-sqlite3\` remain runtime dependencies and may be unpacked/rebuilt.

## Packaging Targets

- macOS: DMG, hardened runtime, entitlements, notarization enabled by config.
- Windows: NSIS setup and portable executable, \`hermes-agent.exe\`.
- Linux: AppImage, Snap, Deb, RPM.

## Packaging Configuration

${block("yaml", builder)}

## Winget

\`scripts/generate-winget-manifests.mjs\` uses templates under \`build/winget\` to generate Windows package metadata for release artifacts.

## Local Unsigned Build Notes

Local build machines without signing credentials can produce artifacts by overriding code signing/notarization:

${unsignedBuildBlock}

Unsigned artifacts install but trigger Gatekeeper/SmartScreen warnings.

## Release Artifacts

Expected artifact names:

- \`hermes-desktop-0.5.2-arm64.dmg\`
- \`hermes-desktop-0.5.2-setup.exe\`
- \`hermes-desktop-0.5.2-portable.exe\`
- \`hermes-desktop-0.5.2.AppImage\`
- \`hermes-desktop-0.5.2.deb\`
- \`hermes-desktop-0.5.2.rpm\`

## Areas for Review

- Should the project add CI jobs for typecheck/test/package matrix?
- Should GitHub publishing point to \`Antman1526/hermes-desktop-Max\` for this fork instead of upstream \`fathah/hermes-desktop\`?
- Should package artifacts include SBOM/checksums for local install verification?
`,
);

writeDoc(
  files[11],
  `${title(12, "Error Handling and Logging")}

## Error Handling Patterns

The project uses pragmatic error handling:

- Main IPC handlers often catch exceptions and return \`false\`, \`null\`, empty arrays, or \`{ success: false, error }\`.
- File readers treat missing/corrupt local state as empty/default state.
- Child process managers attach \`error\`/\`close\` listeners and clear process references.
- Health checks use short timeouts and return booleans.
- User-facing errors are surfaced through renderer state or progress streams.

## Global Main Guard

${block("ts", code("src/main/index.ts", 190, 210))}

## Config Read Defaults

\`readDesktopConfig\` intentionally swallows parse/read errors and returns an empty object so startup survives bad config.

${block("ts", code("src/main/config.ts", 47, 64))}

## Paperclip Error Pattern

${block("ts", code("src/main/paperclip.ts", 168, 218))}

## Logging

Log sources:

- Electron main console output.
- Hermes Agent logs under \`HERMES_HOME/logs\`.
- Gateway log files read by \`read-logs\`.
- Installer progress emitted over \`install-progress\`.
- OAuth progress emitted over \`oauth-login-progress\`.
- Claw3d logs through \`claw3d-get-logs\`.
- Updater logs through \`updater-log.ts\`.

## Debugging Procedure

1. Run \`npm run dev:fresh\` for a clean \`HERMES_HOME\`.
2. Use Settings log viewer for gateway/agent logs.
3. Run \`runHermesDoctor\` from Settings or \`window.hermesAPI.runHermesDoctor()\`.
4. Check \`desktop.json\`, \`.env\`, \`config.yaml\`, and \`models.json\`.
5. For local model issues, check \`local-model-server.pid\`, \`local-model-server-model\`, \`local-model-server-port\`, \`llama-server\` availability, and \`http://127.0.0.1:<port>/v1/models\`.

## Areas for Review

- Should all IPC handlers use structured error codes and renderer-localized messages?
- Should logs be redacted centrally for API keys and tokens?
- Should child process logs be persisted per subsystem rather than swallowed with \`stdio: "ignore"\`?
`,
);

writeDoc(
  files[12],
  `${title(13, "Performance Optimization and Caching")}

## Existing Optimizations

- Session summary cache avoids reading SQLite on every navigation.
- Session cache sync uses Map-based merges and chunked stale count refresh.
- Config reads use a five-second in-memory cache.
- SSH/session/profile file reads avoid work when files are absent.
- SSE streaming renders incrementally rather than waiting for full completion.
- Package config excludes docs/tests/scripts from app artifacts.

## Config Cache

${block("ts", code("src/main/config.ts", 90, 113))}

## Session Cache Optimization

${block("ts", code("src/main/session-cache.ts", 104, 178))}

## Local Model Discovery Performance

Discovery is synchronous and recursive. This is simple and deterministic, but can block if model roots are large or on a slow external disk.

${block("ts", code("src/main/local-model-files.ts", 28, 66))}

## Renderer Performance

The UI uses local state and memoization sparingly. Large transcripts rely on component decomposition rather than virtualization. Session lists use cached summaries. Markdown rendering and syntax highlighting are potentially expensive for long conversations.

## Packaging Performance

\`electron-builder.yml\` explicitly includes only \`out/**\`, \`resources/**\`, and \`package.json\`, then excludes source/tests/docs/scripts/logs/maps/cache. This reduces packaged artifact size and avoids traversing the full workspace.

## Areas for Review

- Add async/cancellable local model scanning and cache results with file mtimes.
- Virtualize long chat transcripts and session lists.
- Debounce repeated settings writes from form-heavy screens.
- Split large IPC registration so startup does not import every subsystem eagerly.
- Consider lazy loading heavy screens such as Kanban, Office, Paperclip, and Settings.
`,
);

writeDoc(
  files[13],
  `${title(14, "Security Implementation and Best Practices")}

## Electron Hardening

Security-critical renderer operations are isolated behind preload. External navigation and webviews are restricted by allowlists.

${block("ts", code("src/main/security.ts", 1, 67))}

## BrowserWindow Expectations

The production renderer should run with context isolation, no Node integration, controlled preload, denied arbitrary navigation, and hardened webview preferences. \`hardenAttachedWebContents\` denies popups and prevents non-local webview navigation.

## IPC Boundary

Renderer input enters privileged code through IPC only. Risk areas are channels that accept file paths, URLs, env keys, commands, or external provider config:

- \`read-file\`, \`read-directory\`, \`open-file-in-editor\`, \`read-image-file\`.
- \`open-external\`, \`open-paperclip\`.
- \`set-env\`, \`set-config\`, \`set-connection-config\`, \`set-ssh-config\`.
- \`start-local-model-server\`, \`start-paperclip\`, Claw3d process channels.

## Input Validation Examples

\`validateEnvEntry\` rejects invalid environment names and multiline values. \`normalizePaperclipUrl\` allows only HTTP/HTTPS and falls back to localhost.

${block("ts", code("src/main/config.ts", 160, 178))}

${block("ts", code("src/main/paperclip.ts", 46, 62))}

## Local Model Launch Restrictions

The \`llama-server\` launcher rejects non-GGUF files and rejects paths outside discovered local model folders.

${block("ts", code("src/main/local-model-server.ts", 31, 58))}

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
`,
);

writeDoc(
  files[14],
  `${title(15, "File Structure and Code Organization")}

## Top-Level Structure

${topLevelTreeBlock}

## Main Process Modules

- \`index.ts\` - app lifecycle and IPC registry.
- \`installer.ts\` - Hermes installation, paths, doctor/update/backup/import/logs.
- \`hermes.ts\` - API server/gateway/chat routing and streaming.
- \`config.ts\` - desktop config, env, YAML, provider config, credential pools.
- \`models.ts\`, \`local-model-files.ts\`, \`local-model-server.ts\` - saved models and local file launch.
- \`sessions.ts\`, \`session-cache.ts\` - SQLite and cache read/write.
- \`profiles.ts\`, \`memory.ts\`, \`soul.ts\`, \`skills.ts\`, \`tools.ts\` - core Hermes user data.
- \`ssh-tunnel.ts\`, \`ssh-remote.ts\`, \`ssh-options.ts\` - remote/SSH mode.
- \`paperclip.ts\`, \`claw3d.ts\`, \`office-start.ts\` - sidecar systems.
- \`security.ts\` - URL/webview policies.

## Preload Modules

- \`index.ts\` - exposes \`window.hermesAPI\` and \`window.electron\`.
- \`index.d.ts\` - ambient renderer types.
- \`askpass.ts\` - askpass-specific preload for sudo credential prompts.

## Renderer Organization

Screens are feature folders. Chat is further split into hooks and subcomponents due to complexity.

${chatTreeBlock}

## Naming Conventions

- Main modules are lowercase kebab-ish or noun-based TypeScript files.
- Renderer screens are PascalCase component folders.
- Tests use \`*.test.ts\` or \`*.test.tsx\`.
- Shared locale files are grouped by language and domain.

## Dependency Direction

- Renderer must not import \`src/main\`.
- Preload imports Electron and shared types only.
- Main imports shared types/helpers when needed.
- Shared modules must stay renderer/main safe unless explicitly typed otherwise.

## Areas for Review

- Split \`src/main/index.ts\` IPC handlers into domain registrars.
- Add generated API docs from \`src/preload/index.ts\`.
- Move duplicate provider/env mappings into a shared pure data module.
- Consider a \`src/main/domains/<domain>\` structure for new subsystems.
`,
);

writeDoc(
  "AI_REVIEW_PACK.md",
  `# Hermes Desktop Max - AI Review Pack

Generated from repository state on ${generatedOn}. This condensed three-page pack is designed for another AI reviewer to quickly reason about optimization, refactoring, patterns, and architecture.

## Page 1 - Project Overview

Hermes Desktop Max is an Electron + React desktop application for installing and operating Hermes Agent. The app owns the GUI, local process orchestration, profile/config editing, sessions UI, model registry, local model discovery, and sidecar integrations. Hermes Agent remains the backend brain and stores conversation state in SQLite.

Core stack: Electron 39, electron-vite 5, Vite 7, React 19, TypeScript 5.9, Tailwind 4, better-sqlite3, Vitest 4, electron-builder 26. Runtime state lives mostly under \`~/.hermes\`.

High-level data flow:

\`\`\`mermaid
flowchart TD
  React["React screens"] --> API["window.hermesAPI"]
  API --> IPC["ipcRenderer.invoke"]
  IPC --> Main["ipcMain handlers"]
  Main --> Files["~/.hermes files"]
  Main --> DB["state.db"]
  Main --> Proc["Hermes / Paperclip / llama-server / Claw3d child processes"]
  Main --> HTTP["Hermes API / remote providers"]
\`\`\`

Important trade-off: privileged work is centralized in the main process, which is easy to audit but has produced a very large \`src/main/index.ts\` IPC registry. Renderer code is mostly cleanly separated from Node access.

## Page 2 - Key Code Walkthrough

### Preload bridge

${block("ts", code("src/preload/index.ts", 35, 70))}

Intent: expose a narrow API surface and keep Node/Electron objects out of React. Review concern: the surface is now very large and lacks runtime input validators.

### Local model discovery

${block("ts", code("src/main/local-model-files.ts", 8, 78))}

Intent: make Antman's local model folders first-class model options. Review concern: synchronous recursive scanning may block if external storage is slow.

### Safe local model launching

${block("ts", code("src/main/local-model-server.ts", 126, 183))}

Intent: only launch discovered GGUF files through \`llama-server\`. Review concern: process lifecycle patterns are duplicated across several modules.

### Session cache

${block("ts", code("src/main/session-cache.ts", 104, 178))}

Intent: avoid startup/session-list slowdown with thousands of sessions. Review concern: cache invalidation is file-based and not schema-versioned.

## Page 3 - Dependencies, Pain Points, and Design Trade-Offs

Data dependencies:

- SQLite \`state.db\` tables \`sessions\`, \`messages\`, and optional \`messages_fts\`.
- JSON stores: \`desktop.json\`, \`models.json\`, \`desktop/sessions.json\`.
- YAML store: \`config.yaml\`.
- Profile env files containing provider/tool secrets.

Known limitations and technical debt:

- \`src/main/index.ts\` is a central IPC hot spot with many unrelated responsibilities.
- Provider/env-key mapping is duplicated across renderer constants, installer, setup/models screens, and chat routing.
- Secrets are stored in profile files rather than OS credential stores.
- Local model roots are hard-coded for this fork.
- Local model scanning is synchronous.
- Error payloads are inconsistent: boolean, null, throws, and \`{ success, error }\` all coexist.
- Electron-builder packaging can be slow if file globs include too much workspace content; current config narrows packaged files.

## Areas for Review

- What IPC handlers should be split into domain registrars first?
- How would you design a shared provider registry that covers UI labels, env keys, install gates, and runtime routing?
- Should local model folders be configurable in Settings, and how should the app cache scans?
- Which secrets should move to OS keychain first?
- What runtime validation library or pattern should guard the preload/main IPC boundary?
- Should session cache and desktop config files receive explicit schema versions and migrations?
`,
);

writeDoc(
  "TECHNOLOGY_AUDIT.md",
  `# Hermes Desktop Max - Technology Audit

Generated from repository state on ${generatedOn}. This audit identifies technologies, frameworks, libraries, tools, languages, and services used by this codebase and explains their role in this project.

## Languages and Runtimes

- **TypeScript** - primary language for Electron main, preload, renderer, shared code, and tests.
- **JavaScript / ECMAScript modules** - used by tooling scripts such as Winget manifest generation and this documentation generator.
- **TSX / JSX** - React UI component syntax in renderer screens.
- **CSS** - renderer styling in \`base.css\`, \`main.css\`, and Tailwind-generated utilities.
- **YAML** - electron-builder config, Winget templates, and Hermes Agent \`config.yaml\` edits.
- **JSON** - npm metadata, lockfile, desktop state, models, session cache.
- **SQLite SQL** - read queries against Hermes Agent \`state.db\`.
- **Bash/Shell** - npm scripts and build/dev workflows.
- **PowerShell/Windows shell concepts** - Windows installer/runtime path support through code paths and packaging.

## Application Frameworks

- **Electron** - desktop runtime, BrowserWindow, IPC, shell integration, updater context, and native packaging target.
- **Electron Toolkit** - Electron utility helpers, TypeScript config, ESLint config, preload utilities.
- **electron-vite** - builds separate main, preload, and renderer bundles.
- **React** - renderer UI framework for every screen.
- **React DOM** - mounts React renderer into Electron's HTML.
- **Vite** - renderer/build tooling under electron-vite.
- **Tailwind CSS** - utility CSS pipeline through \`@tailwindcss/vite\`.

## Data and Storage

- **better-sqlite3** - synchronous SQLite access to Hermes Agent \`state.db\` for sessions, messages, FTS search, and cache refresh.
- **File-system JSON stores** - \`desktop.json\`, \`models.json\`, \`desktop/sessions.json\`, state files for local model server and Claw3d.
- **YAML config files** - Hermes Agent \`config.yaml\` read/write through custom dotted-path logic.
- **Environment files** - profile \`.env\` files store provider/tool/messaging keys.

## UI Libraries

- **lucide-react** - icon set used for buttons and screen UI.
- **react-markdown** - markdown rendering for assistant responses and docs-like content.
- **remark-gfm** - GitHub-flavored markdown support.
- **highlight.js** - syntax highlighting support.
- **react-syntax-highlighter** - React syntax-highlighted code blocks.
- **react-file-icon** - file-type icons for attachments and file previews.
- **vscode-material-icons** - file icon mapping/assets.
- **lucide-react file icons** - local file tree icons in WorktreePanel, replacing the older bundled SVG icon dependency.

## Runtime Dependencies From package.json

${dependencyList}

## Development Dependencies From package.json

${devDependencyList}

## Internationalization and Analytics

- **i18next** - translation engine for shared locale strings.
- **react-i18next** - React bindings for i18n.
- **PostHog** - optional renderer analytics when \`VITE_POSTHOG_KEY\` is configured.

## Build, Packaging, and Release

- **electron-builder** - DMG, NSIS, portable EXE, AppImage, Snap, Deb, RPM packaging and app dependency install.
- **NSIS** - Windows installer target through electron-builder.
- **DMG tooling / hdiutil** - macOS disk image creation.
- **codesign / notarization** - macOS signing/notarization path configured by electron-builder.
- **Winget manifests** - generated from templates under \`build/winget\`.

## Testing and Quality

- **Vitest** - unit/integration test runner.
- **jsdom** - DOM environment for renderer tests.
- **Testing Library React** - renderer component tests.
- **Testing Library DOM** - DOM assertions/utilities.
- **jest-dom** - extended DOM matchers.
- **Playwright** - browser/Electron-adjacent automation dependency for smoke/e2e tooling.
- **ESLint** - static analysis.
- **eslint-plugin-react** - React linting.
- **eslint-plugin-react-hooks** - hook correctness rules.
- **eslint-plugin-react-refresh** - Vite refresh safety rules.
- **Prettier** - formatting.

## External Services and APIs

- **Hermes Agent** - local/remote backend, CLI, API server, state DB, profiles, tools, skills, memory, gateway.
- **OpenRouter, Anthropic, OpenAI, Google Gemini, xAI, Nous, Qwen, MiniMax, Hugging Face** - primary model provider integrations.
- **Groq, DeepSeek, Together, Fireworks, Cerebras, Mistral, Perplexity** - OpenAI-compatible hosted endpoints.
- **LM Studio, Atomic Chat, Ollama, vLLM, llama.cpp, Docker Model Runner** - local OpenAI-compatible model runtimes.
- **llama-server** - launched for discovered GGUF local model files at \`http://localhost:<8080-8099>/v1\`; the actual selected port is saved back to model config.
- **Paperclip AI** - sidecar control-plane server launched through \`npx paperclipai run\`.
- **OpenChronicle** - memory provider through Streamable HTTP MCP endpoint.
- **Honcho, Hindsight, Mem0, RetainDB, Supermemory, OpenViking, ByteRover** - optional memory providers.
- **Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, Email, Twilio/Vonage SMS, BlueBubbles, DingTalk, Feishu/Lark, WeCom, WeChat/iLink, Webhooks, Home Assistant** - messaging gateways configured by the desktop.
- **Exa, Parallel, Tavily, Firecrawl, Browserbase, FAL.ai, Weights & Biases, Tinker** - tool integrations exposed by Hermes configuration.

## Native and OS Facilities

- **Node child_process** - starts Hermes, Paperclip, llama-server, Claw3d, installer/update/doctor commands.
- **Node fs/path/os/http/https/crypto** - local state IO, platform paths, health checks, stable IDs, random keys.
- **Electron shell/dialog/clipboard/Notification/Menu** - native desktop affordances.
- **SSH** - remote mode/tunnel support.
- **Git** - Hermes install/update and repository development workflow.
- **uv and Python** - Hermes Agent dependency/runtime setup.

## Minor Utilities With Meaningful Roles

- **@types packages** - compile-time types for Node, React, better-sqlite3, highlighting libraries.
- **rollup via Vite/electron-vite** - bundle mechanics.
- **ESLint flat config** - modern lint configuration format.
- **entitlements plist files** - macOS runtime permissions.
`,
);

writeDoc(
  "INDEX.md",
  `# Hermes Desktop Max Reconstruction Documentation

This folder contains the requested technical documentation pack for recreating and auditing Hermes Desktop Max.

## 15-document reconstruction pack

${files.map((file, i) => `${i + 1}. [${file}](./${file})`).join("\n")}

## Additional requested artifacts

- [AI_REVIEW_PACK.md](./AI_REVIEW_PACK.md) - dense three-page review context with Areas for Review.
- [TECHNOLOGY_AUDIT.md](./TECHNOLOGY_AUDIT.md) - exhaustive technology/framework/library/tool audit.

## Rebuild entry point

Start with \`01-project-overview-architecture.md\`, then read \`02-environment-setup-dependencies.md\`, \`04-backend-api-specifications.md\`, and \`05-frontend-architecture-components.md\`. Use \`15-file-structure-code-organization.md\` as the implementation map.
`,
);

const readme = `# Hermes Desktop Max

<img width="100%" alt="HERMES DESKTOP" src="previews/header.webp" />

Hermes Desktop Max is Antman's fork of [Hermes Desktop](https://github.com/fathah/hermes-desktop), a native Electron app for installing, configuring, and chatting with [Hermes Agent](https://github.com/NousResearch/hermes-agent). The app provides a full desktop control surface for local or remote Hermes Agent usage: chat, sessions, models, profiles, memory, skills, tools, schedules, gateways, Office/Claw3d, Paperclip, settings, backup/import, and diagnostics.

This fork is currently aligned with upstream release \`v${pkg.version}\` and adds local model discovery and launch support for Antman's local model folders.

## Technology Stack

- **Desktop runtime:** Electron \`^39.2.6\`.
- **Build system:** electron-vite \`^5.0.0\`, Vite \`^7.2.6\`, TypeScript \`^5.9.3\`.
- **UI:** React \`^19.2.1\`, React DOM \`^19.2.1\`, CSS in \`src/renderer/src/assets/main.css\`, lucide-react icons.
- **Main-process storage access:** \`better-sqlite3\` \`^12.8.0\` for read access to Hermes Agent \`state.db\`.
- **Localization:** i18next and react-i18next.
- **Markdown/chat rendering:** react-markdown, remark-gfm, highlight.js, react-syntax-highlighter.
- **Packaging:** electron-builder \`^26.0.12\` for DMG, NSIS setup EXE, portable EXE, AppImage, snap, deb, and rpm targets.
- **Testing:** Vitest, jsdom, Testing Library, Playwright support scripts.
- **Backend dependency:** Hermes Agent is installed/adopted under \`~/.hermes\` and is controlled through local CLI commands, a local API server, remote HTTP mode, or SSH tunnel mode.

## Fork Highlights

- Scans local model files from:
  - \`/Users/Antman/Desktop/AI_Models\` (primary local/default root)
  - \`/Volumes/MainStore/Development/AI_Models\` (fallback external-drive root)
- Prioritizes launchable Desktop GGUF files under \`/Users/Antman/Desktop/AI_Models/GGUF\` when no model has been configured yet.
- Validates local model launch requests so only discovered GGUF files under configured model roots can start \`llama-server\`.
- Adds discovered \`.gguf\` and \`.safetensors\` files to the saved model library.
- Launches discovered \`.gguf\` models through local \`llama-server\`, starting at \`http://localhost:8080/v1\` and searching through \`8099\` when ports are occupied.
- Keeps \`.safetensors\` files discoverable while marking them non-launchable by the built-in llama.cpp launcher.
- Adds Paperclip sidecar configuration/status/start/stop/open support.
- Keeps OpenChronicle memory-provider wiring available through Hermes memory provider configuration.
- Includes Windows-oriented runtime path handling and installer support.
- Narrows packaged app files to built output/resources/package metadata to reduce package traversal and artifact size.

## Runtime Modes

Hermes Desktop Max supports three connection modes stored in \`~/.hermes/desktop.json\`.

| Mode | Backend path | What works |
| --- | --- | --- |
| \`local\` | Desktop launches and manages local Hermes Agent processes under \`~/.hermes\`. | Full feature set, including files, profiles, skills, sessions, local models, gateway, schedules, Paperclip, and Claw3d. |
| \`remote\` | Desktop talks to a remote Hermes API URL with an optional bearer key. | Chat and API-backed features. File-system-only screens are disabled or read-only where no remote API exists. |
| \`ssh\` | Desktop opens an SSH tunnel and executes remote Hermes CLI/file operations over SSH. | Intended to preserve local-mode feature parity on a remote host, including profiles, skills, memory, models, sessions, and Kanban where supported. |

The renderer never imports Node or Electron directly. Privileged operations flow through \`src/preload/index.ts\`, which exposes \`window.hermesAPI\`, and \`src/main/app-main.ts\`, which registers the corresponding \`ipcMain.handle(...)\` handlers.

## Installers

Recent local unsigned installers were generated in:

- \`/Users/Antman/Downloads/hermes-desktop-max-0.5.2-arm64.dmg\`
- \`/Users/Antman/Downloads/hermes-desktop-0.5.2-setup.exe\`
- \`/Users/Antman/Downloads/hermes-desktop-0.5.2-portable.exe\`

Unsigned local builds may trigger macOS Gatekeeper or Windows SmartScreen warnings.

## Features

- Guided Hermes Agent install and update flow.
- Local, remote, and SSH connection modes.
- Streaming chat with tool progress, markdown, syntax highlighting, attachments, and session resume.
- Saved model CRUD with default, custom-provider, and local-file entries.
- Provider setup for hosted, local, and custom OpenAI-compatible endpoints.
- Profile isolation under \`~/.hermes/profiles/<name>\`.
- Memory entry editing, user profile editing, and provider discovery/configuration.
- Skill browsing, install, import, and uninstall workflows.
- Toolset enable/disable controls.
- Cron/schedule management with delivery targets.
- Messaging gateway configuration and process control.
- Hermes Office / Claw3d control panel.
- Paperclip sidecar management.
- Backup, import, debug dump, logs, diagnostics, and updater controls.

## Core Data Locations

Default local install paths:

\`\`\`text
~/.hermes/
~/.hermes/config.yaml
~/.hermes/.env
~/.hermes/desktop.json
~/.hermes/models.json
~/.hermes/state.db
~/.hermes/desktop/sessions.json
~/.hermes/profiles/<profile>/
\`\`\`

Important desktop state files:

- \`desktop.json\` stores connection mode, remote URL, SSH config, local model roots, and desktop-specific sidecar settings.
- \`models.json\` stores saved default, custom-provider, and local-file model entries.
- \`desktop/sessions.json\` caches session summaries from Hermes Agent \`state.db\` for fast renderer reads.
- \`local-model-scan.json\` stores the latest local model root scan result.
- \`local-model-server.pid\`, \`local-model-server-model\`, \`local-model-server-port\`, and \`local-model-server.log\` track managed \`llama-server\` state.

Named profiles live under \`~/.hermes/profiles/<profile>\` and have their own config/env/memory/skills/session-cache paths.

## Architecture

\`\`\`mermaid
flowchart LR
  UI["React renderer"] --> Bridge["Preload contextBridge"]
  Bridge --> Main["Electron main process"]
  Main --> Agent["Hermes Agent local/remote API"]
  Main --> DB["Hermes state.db"]
  Main --> Files["~/.hermes files"]
  Main --> Sidecars["llama-server / Paperclip / Claw3d"]
\`\`\`

Key implementation modules:

- \`src/main/index.ts\` bootstraps Electron main and imports \`app-main\`.
- \`src/main/app-main.ts\` owns BrowserWindow creation, menu setup, updater wiring, and IPC registration.
- \`src/main/hermes.ts\` starts/stops the Hermes gateway, routes chat requests, streams SSE chunks, and handles remote/SSH URL behavior.
- \`src/main/config.ts\` reads/writes \`desktop.json\`, \`.env\`, and YAML config values.
- \`src/main/models.ts\`, \`src/main/local-model-files.ts\`, and \`src/main/local-model-server.ts\` implement model registry, GGUF/safetensors discovery, active default selection, and \`llama-server\` process control.
- \`src/main/skills.ts\` manages local/curated skill browsing and mandatory SkillOpt installation.
- \`src/main/ssh-remote.ts\` mirrors local feature operations over SSH.
- \`src/main/session-cache.ts\` reads Hermes \`state.db\` with \`better-sqlite3\` and writes profile-local session summary caches.
- \`src/renderer/src/App.tsx\` handles splash/install/setup/main routing.
- \`src/renderer/src/screens/Layout/Layout.tsx\` owns the persistent sidebar and feature pane mounting.
- \`src/renderer/src/screens/Chat\` contains chat state, IPC streaming hooks, model picker, attachments, session resume, and local commands.

## Local GGUF Model Behavior

The default model roots are defined in \`src/main/config.ts\`:

\`\`\`ts
export const DEFAULT_LOCAL_MODEL_ROOTS = [
  join(homedir(), "Desktop", "AI_Models"),
  "/Volumes/MainStore/Development/AI_Models",
];
\`\`\`

The scanner accepts \`.gguf\` and \`.safetensors\` files larger than 1 MiB, ignores \`._*\` macOS sidecar files, filters likely embedding-only model names, and turns each file into a saved model entry. GGUF files are launchable; safetensors files remain visible but require an external compatible server.

When no model is configured, the app selects the first available launchable GGUF from the primary Desktop root, preferring \`/Users/Antman/Desktop/AI_Models/GGUF\`. Launch requests are hardened so the renderer cannot ask the main process to start an arbitrary GGUF path outside configured/discovered roots.

The \`llama-server\` launcher:

- Looks for \`/opt/homebrew/bin/llama-server\`, \`/usr/local/bin/llama-server\`, then \`PATH\`.
- Starts at port \`8080\` and searches through \`8099\`.
- Uses \`--host 127.0.0.1\`, \`--ctx-size 16384\`, \`--no-warmup\`, and an alias equal to the model path.
- Saves the actual selected OpenAI-compatible base URL back into model config.
- Surfaces readiness in the chat model picker as \`Starting\`, \`Ready\`, or \`Error\`.

## SkillOpt Integration

Microsoft SkillOpt-inspired workflow guidance is bundled under:

\`\`\`text
resources/curated-skills/skillopt/skills/skillopt/SKILL.md
\`\`\`

The SkillOpt skill is mandatory for the sleep-cycle workflow. It is auto-seeded into local and SSH profiles, marked \`required\` in the skills UI, and cannot be uninstalled through local or remote-backed skill operations.

## Development

### Requirements

- Node.js/npm
- Git
- Python 3.11+ and \`uv\` for local Hermes Agent install flows
- Platform packaging tools when building native installers

### Setup

\`\`\`bash
npm install
npm run typecheck
npm test
npm run dev
\`\`\`

Use a temporary Hermes home for isolated development:

\`\`\`bash
npm run dev:fresh
\`\`\`

### Common Checks

\`\`\`bash
npm run typecheck
npm test
npm run lint
\`\`\`

### Build

\`\`\`bash
npm run build
npm run build:mac
npm run build:win
npm run build:linux
\`\`\`

For unsigned local macOS builds:

\`\`\`bash
CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac dmg --arm64 --publish never -c.mac.notarize=false
\`\`\`

Windows packaging from macOS uses electron-builder's Windows targets. This repository is configured for:

- NSIS setup: \`hermes-desktop-0.5.2-setup.exe\`
- Portable EXE: \`hermes-desktop-0.5.2-portable.exe\`

The DMG target is:

- macOS arm64 DMG: \`hermes-desktop-max-0.5.2-arm64.dmg\`

## Verification

Before publishing or packaging, run:

\`\`\`bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
\`\`\`

Packaging verification used for local release artifacts:

\`\`\`bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
npm run build:win
hdiutil verify /Users/Antman/Downloads/hermes-desktop-max-0.5.2-arm64.dmg
shasum -a 256 /Users/Antman/Downloads/hermes-desktop-max-0.5.2-arm64.dmg
\`\`\`

## Documentation

The reconstruction and audit documentation requested for this fork lives in:

- [docs/project-reconstruction/INDEX.md](docs/project-reconstruction/INDEX.md)
- [docs/project-reconstruction/AI_REVIEW_PACK.md](docs/project-reconstruction/AI_REVIEW_PACK.md)
- [docs/project-reconstruction/TECHNOLOGY_AUDIT.md](docs/project-reconstruction/TECHNOLOGY_AUDIT.md)

Documentation pack last regenerated: \`${generatedOn}\`.

Those documents are written to give another AI system enough context to recreate the project, audit its architecture, and identify improvement opportunities.

## Important Paths

- \`src/main\` - Electron main process modules and privileged operations.
- \`src/preload\` - typed bridge exposed to the renderer.
- \`src/renderer/src\` - React UI.
- \`src/shared\` - shared i18n and attachment types.
- \`tests\` - main/shared unit tests.
- \`electron-builder.yml\` - native packaging configuration.

## Attribution

This repository is a fork of the upstream [Hermes Desktop](https://github.com/fathah/hermes-desktop) project. Upstream design and Hermes Agent integration belong to the original project and contributors. This fork layers Antman's local model, memory, packaging, and Windows workflow improvements on top.

## License

MIT. See [LICENSE](LICENSE).
`;

writeFileSync(join(root, "README.md"), readme, "utf8");

console.log(
  `Generated ${files.length + 3} documentation artifacts in ${docsDir}`,
);
