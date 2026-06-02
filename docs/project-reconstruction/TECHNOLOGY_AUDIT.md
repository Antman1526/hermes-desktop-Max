# Hermes Desktop Max - Technology Audit

Generated from repository state on 2026-06-02. This audit identifies technologies, frameworks, libraries, tools, languages, and services used by this codebase and explains their role in this project.

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

- **Electron** - desktop runtime, BrowserWindow, IPC, shell integration, updater context, and native packaging target.
- **Electron Toolkit** - Electron utility helpers, TypeScript config, ESLint config, preload utilities.
- **electron-vite** - builds separate main, preload, and renderer bundles.
- **React** - renderer UI framework for every screen.
- **React DOM** - mounts React renderer into Electron's HTML.
- **Vite** - renderer/build tooling under electron-vite.
- **Tailwind CSS** - utility CSS pipeline through `@tailwindcss/vite`.

## Data and Storage

- **better-sqlite3** - synchronous SQLite access to Hermes Agent `state.db` for sessions, messages, FTS search, and cache refresh.
- **File-system JSON stores** - `desktop.json`, `models.json`, `desktop/sessions.json`, state files for local model server and Claw3d.
- **YAML config files** - Hermes Agent `config.yaml` read/write through custom dotted-path logic.
- **Environment files** - profile `.env` files store provider/tool/messaging keys.

## UI Libraries

- **lucide-react** - icon set used for buttons and screen UI.
- **react-markdown** - markdown rendering for assistant responses and docs-like content.
- **remark-gfm** - GitHub-flavored markdown support.
- **highlight.js** - syntax highlighting support.
- **react-syntax-highlighter** - React syntax-highlighted code blocks.
- **react-file-icon** - file-type icons for attachments and file previews.
- **@wesbos/code-icons** - code/file icon assets.
- **vscode-material-icons** - file icon mapping/assets.

## Internationalization and Analytics

- **i18next** - translation engine for shared locale strings.
- **react-i18next** - React bindings for i18n.
- **PostHog** - optional renderer analytics when `VITE_POSTHOG_KEY` is configured.

## Build, Packaging, and Release

- **electron-builder** - DMG, NSIS, portable EXE, AppImage, Snap, Deb, RPM packaging and app dependency install.
- **NSIS** - Windows installer target through electron-builder.
- **DMG tooling / hdiutil** - macOS disk image creation.
- **codesign / notarization** - macOS signing/notarization path configured by electron-builder.
- **Winget manifests** - generated from templates under `build/winget`.

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
- **llama-server** - launched for discovered GGUF local model files at `http://localhost:8080/v1`.
- **Paperclip AI** - sidecar control-plane server launched through `npx paperclipai run`.
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
