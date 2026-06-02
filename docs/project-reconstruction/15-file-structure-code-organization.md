# 15 - File Structure and Code Organization

Generated from repository state on 2026-06-02. No secrets are included; environment-variable names are documented without values.

## Top-Level Structure

```text
.
├── build/                    # icons, entitlements, Linux hooks, winget templates
├── changelogs/               # release notes
├── docs/                     # technical docs and superpowers plans/specs
├── previews/                 # README screenshots and header images
├── resources/                # Electron app resources
├── scripts/                  # release/debug/e2e helper scripts
├── src/
│   ├── main/                 # privileged Electron main process modules
│   ├── preload/              # contextBridge API declarations and preload bundles
│   ├── renderer/             # React app
│   └── shared/               # shared attachment and i18n logic
└── tests/                    # main/shared unit tests
```

## Main Process Modules

- `index.ts` - app lifecycle and IPC registry.
- `installer.ts` - Hermes installation, paths, doctor/update/backup/import/logs.
- `hermes.ts` - API server/gateway/chat routing and streaming.
- `config.ts` - desktop config, env, YAML, provider config, credential pools.
- `models.ts`, `local-model-files.ts`, `local-model-server.ts` - saved models and local file launch.
- `sessions.ts`, `session-cache.ts` - SQLite and cache read/write.
- `profiles.ts`, `memory.ts`, `soul.ts`, `skills.ts`, `tools.ts` - core Hermes user data.
- `ssh-tunnel.ts`, `ssh-remote.ts`, `ssh-options.ts` - remote/SSH mode.
- `paperclip.ts`, `claw3d.ts`, `office-start.ts` - sidecar systems.
- `security.ts` - URL/webview policies.

## Preload Modules

- `index.ts` - exposes `window.hermesAPI` and `window.electron`.
- `index.d.ts` - ambient renderer types.
- `askpass.ts` - askpass-specific preload for sudo credential prompts.

## Renderer Organization

Screens are feature folders. Chat is further split into hooks and subcomponents due to complexity.

```text
src/renderer/src/screens/Chat/
├── Chat.tsx
├── ChatInput.tsx
├── ChatHeader.tsx
├── MessageList.tsx
├── MessageRow.tsx
├── ModelPicker.tsx
├── WorktreePanel.tsx
├── hooks/
│   ├── useChatActions.ts
│   ├── useChatIPC.ts
│   ├── useModelConfig.ts
│   └── ...
└── utilities and tests
```

## Naming Conventions

- Main modules are lowercase kebab-ish or noun-based TypeScript files.
- Renderer screens are PascalCase component folders.
- Tests use `*.test.ts` or `*.test.tsx`.
- Shared locale files are grouped by language and domain.

## Dependency Direction

- Renderer must not import `src/main`.
- Preload imports Electron and shared types only.
- Main imports shared types/helpers when needed.
- Shared modules must stay renderer/main safe unless explicitly typed otherwise.

## Areas for Review

- Split `src/main/index.ts` IPC handlers into domain registrars.
- Add generated API docs from `src/preload/index.ts`.
- Move duplicate provider/env mappings into a shared pure data module.
- Consider a `src/main/domains/<domain>` structure for new subsystems.
