# Hermes Desktop Max - Technology Audit

Generated from repository state on 2026-06-12. This audit identifies technologies, frameworks, libraries, tools, languages, and services used by this codebase and explains their role in this project.

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
- **vscode-material-icons** - file icon mapping/assets.
- **lucide-react file icons** - local file tree icons in WorktreePanel, replacing the older bundled SVG icon dependency.

## Runtime Dependencies From package.json

- `@electron-toolkit/utils` - `^4.0.0`
- `better-sqlite3` - `^12.8.0`
- `electron-updater` - `^6.3.9`
- `i18next` - `^25.6.0`

## Development Dependencies From package.json

- `@electron-toolkit/eslint-config-prettier` - `^3.0.0`
- `@electron-toolkit/eslint-config-ts` - `^3.1.0`
- `@electron-toolkit/preload` - `^3.0.2`
- `@electron-toolkit/tsconfig` - `^2.0.0`
- `@tailwindcss/vite` - `^4.2.2`
- `@testing-library/dom` - `^10.4.1`
- `@testing-library/jest-dom` - `^6.8.0`
- `@testing-library/react` - `^16.3.0`
- `@types/better-sqlite3` - `^7.6.13`
- `@types/highlight.js` - `^9.12.4`
- `@types/node` - `^22.19.1`
- `@types/react` - `^19.2.7`
- `@types/react-dom` - `^19.2.3`
- `@types/react-syntax-highlighter` - `^15.5.13`
- `@vitejs/plugin-react` - `^5.1.1`
- `electron` - `^39.2.6`
- `electron-builder` - `^26.0.12`
- `electron-vite` - `^5.0.0`
- `eslint` - `^9.39.1`
- `eslint-plugin-react` - `^7.37.5`
- `eslint-plugin-react-hooks` - `^7.0.1`
- `eslint-plugin-react-refresh` - `^0.4.24`
- `highlight.js` - `^11.11.1`
- `jsdom` - `^26.1.0`
- `lucide-react` - `^1.7.0`
- `playwright` - `^1.60.0`
- `posthog-js` - `^1.376.0`
- `prettier` - `^3.7.4`
- `react` - `^19.2.1`
- `react-dom` - `^19.2.1`
- `react-file-icon` - `^1.6.0`
- `react-i18next` - `^15.7.3`
- `react-markdown` - `^10.1.0`
- `react-syntax-highlighter` - `^16.1.1`
- `remark-gfm` - `^4.0.1`
- `tailwindcss` - `^4.2.2`
- `typescript` - `^5.9.3`
- `vite` - `^7.2.6`
- `vitest` - `^4.1.4`
- `vscode-material-icons` - `^0.1.1`

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
- **llama-server** - launched for discovered GGUF local model files at `http://localhost:<8080-8099>/v1`; the actual selected port is saved back to model config.
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
