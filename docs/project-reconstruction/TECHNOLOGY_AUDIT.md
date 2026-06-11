# Hermes Desktop Max - Technology Audit

Generated from repository state on 2026-06-11. This audit identifies technologies, frameworks, libraries, tools, languages, and services used by this codebase and explains their role in this project.

## Languages and Runtimes

- **TypeScript** - primary language for Electron main, preload, renderer, shared code, and tests.
- **JavaScript / ECMAScript modules** - used by tooling scripts such as Winget manifest generation and this documentation generator.
- **TSX / JSX** - React UI component syntax in renderer screens.
- **CSS** - renderer styling in `base.css`, `main.css`, and Tailwind-generated utilities.
- **YAML** - electron-builder config, Winget templates, and Hermes Agent `config.yaml` edits.
- **JSON** - npm metadata, lockfile, desktop state, models, session cache.
- **SQLite SQL** - read queries against Hermes Agent `state.db`.
- **Bash/Shell** - npm scripts and build/dev workflows.
- **PowerShell/Windows shell concepts** - Windows installer/runtime path support through code paths and packaging.

## Application Frameworks

- **Electron 39.8.5** - desktop runtime, BrowserWindow lifecycle, IPC, shell/dialog/clipboard/menu/notification integration, native updater context, and target runtime for packaged apps.
- **@electron-toolkit/utils 4.0.0** - `electronApp`, `optimizer`, and dev/prod helpers in the main process.
- **@electron-toolkit/preload 3.0.2** - typed/safe preload utilities used around contextBridge exposure.
- **@electron-toolkit/tsconfig 2.0.0** - base TypeScript configuration for Electron projects.
- **electron-vite 5.0.0** - builds separate main, preload, and renderer bundles from `electron.vite.config.ts`.
- **Vite 7.3.1** - renderer/build tooling underneath electron-vite.
- **@vitejs/plugin-react 5.2.0** - React transform and Fast Refresh integration for the renderer.
- **React 19.2.4** - renderer UI framework for every screen.
- **React DOM 19.2.4** - mounts React into `src/renderer/index.html`.
- **Tailwind CSS 4.2.2** - utility CSS engine used by renderer styles.
- **@tailwindcss/vite 4.2.2** - Vite plugin that wires Tailwind into the renderer build.

## Data and Storage

- **better-sqlite3 12.8.0** - synchronous SQLite access to Hermes Agent `state.db` for sessions, messages, FTS search, message decoding, and session-cache refresh.
- **File-system JSON stores** - `desktop.json`, `models.json`, `desktop/sessions.json`, state files for local model server and Claw3d.
- **YAML config files** - Hermes Agent `config.yaml` read/write through custom dotted-path logic.
- **Environment files** - profile `.env` files store provider/tool/messaging keys.

## UI Libraries

- **lucide-react 1.7.0** - icon set used for buttons, navigation, status indicators, and dense tool controls.
- **react-markdown 10.1.0** - markdown rendering for assistant responses and docs-like content.
- **remark-gfm 4.0.1** - GitHub-flavored markdown support for tables, task lists, and common response markdown.
- **highlight.js 11.11.1** - syntax highlighting language definitions/styles.
- **react-syntax-highlighter 16.1.1** - React syntax-highlighted code blocks in chat output.
- **react-file-icon 1.6.0** - file-type icons for attachments and file previews.
- **@wesbos/code-icons 1.2.4** - code/file icon assets.
- **vscode-material-icons 0.1.1** - file icon mapping/assets.

## Internationalization and Analytics

- **i18next 25.10.10** - translation engine for shared locale strings in `src/shared/i18n`.
- **react-i18next 15.7.4** - React bindings used by renderer components/screens.
- **posthog-js 1.376.0** - optional renderer analytics when `VITE_POSTHOG_KEY` is configured and telemetry is enabled.

## Build, Packaging, and Release

- **electron-builder 26.8.1** - builds the branded Hermes Desktop Max app, including `hermes-desktop-max-0.5.2-arm64.dmg`, NSIS, portable EXE, AppImage, Snap, Deb, RPM packaging, and app dependency install.
- **electron-updater 6.8.3** - auto-update checks, download, and install lifecycle in the main process.
- **NSIS** - Windows installer target through electron-builder.
- **DMG tooling / hdiutil** - macOS disk image creation.
- **codesign / notarization controls** - electron-builder can sign with local identities; this fork's local `build:mac` disables notarization for developer DMG output.
- **Winget manifests** - generated from templates under `build/winget`.

## Testing and Quality

- **Vitest 4.1.4** - unit/integration test runner for main, shared, preload surface, and renderer tests.
- **jsdom 26.1.0** - DOM environment for renderer tests.
- **@testing-library/react 16.3.2** - renderer component tests.
- **@testing-library/dom 10.4.1** - DOM test helpers.
- **@testing-library/jest-dom 6.9.1** - extended DOM matchers.
- **Playwright 1.60.0** - Electron/browser automation used for smoke and application-level model validation scripts.
- **ESLint 9.39.4** - static analysis through flat config.
- **@electron-toolkit/eslint-config-ts 3.1.0** - Electron TypeScript lint baseline.
- **@electron-toolkit/eslint-config-prettier 3.0.0** - disables lint rules that conflict with Prettier.
- **eslint-plugin-react 7.37.5** - React linting.
- **eslint-plugin-react-hooks 7.0.1** - hook correctness rules.
- **eslint-plugin-react-refresh 0.4.26** - Vite refresh safety rules.
- **Prettier 3.8.1** - formatting.
- **TypeScript 5.9.3** - static typechecking for node/preload and web projects.

## Type Packages

- **@types/node 22.19.15** - Node/Electron main-process type surface.
- **@types/react 19.2.14** - React component/hook types.
- **@types/react-dom 19.2.3** - React DOM mount/render types.
- **@types/better-sqlite3 7.6.13** - SQLite query/database typings.
- **@types/highlight.js 9.12.4** - legacy highlight.js type support.
- **@types/react-syntax-highlighter 15.5.13** - code block rendering types.

## External Services and APIs

- **Hermes Agent** - local/remote backend, CLI, API server, state DB, profiles, tools, skills, memory, gateway.
- **OpenRouter, Anthropic, OpenAI, Google Gemini, xAI, Nous, Qwen, MiniMax, Hugging Face** - primary model provider integrations.
- **Groq, DeepSeek, Together, Fireworks, Cerebras, Mistral, Perplexity** - OpenAI-compatible hosted endpoints.
- **LM Studio, Atomic Chat, Ollama, vLLM, llama.cpp, Docker Model Runner** - local OpenAI-compatible model runtimes.
- **llama-server** - launched for available discovered GGUF local model files at `http://localhost:<port>/v1`; port selection starts at `8080` and searches through `8099`. Missing binaries surface a `brew install llama.cpp` remediation message.
- **Paperclip AI** - sidecar control-plane server launched through `npx paperclipai run`.
- **OpenChronicle** - memory provider through Streamable HTTP MCP endpoint.
- **Honcho, Hindsight, Mem0, RetainDB, Supermemory, OpenViking, ByteRover** - optional memory providers.
- **Microsoft SkillOpt** - bundled as a curated installable Hermes skill (`skill-optimization/skillopt`) with repository/docs metadata in the Skills browser. It provides validation-gated skill optimization guidance rather than vendoring the full Python package into Electron.
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

## Areas for Review

- Which dependencies are runtime-critical versus legacy or unused, and can any UI/icon packages be consolidated?
- Should local model support standardize on one runtime abstraction that can cover `llama-server`, Ollama, LM Studio, and Docker Model Runner?
- Should release tooling add checksums, SBOM generation, and fork-specific GitHub publishing validation?
