# Local Models and Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hermes Desktop Max discover and launch Antman's local models smoothly from MainStore and Desktop, and make macOS DMG output install as a real Hermes app instead of a default Electron bundle.

**Architecture:** Keep local model discovery in `src/main/local-model-files.ts`, local server process control in `src/main/local-model-server.ts`, persistence in `src/main/models.ts`, and status rendering in the existing Chat/Models UI. Packaging remains Electron Builder based; fix metadata/scripts so `npm run build:mac` produces a named Hermes `.app` and `.dmg`.

**Tech Stack:** Electron 39, Electron Builder 26, Electron Vite, React 19, TypeScript, Vitest.

---

### Task 1: Model Library Reconciliation

**Files:**
- Modify: `src/main/local-model-files.ts`
- Modify: `src/main/models.ts`
- Test: `tests/local-model-files.test.ts`

- [ ] Add tests that discovered files include `available: true`, incomplete GGUF files are skipped, and saved local-file models are marked unavailable when their root is absent.
- [ ] Implement `available`, `unavailableReason`, and `rootAvailable` metadata for local model entries.
- [ ] Reconcile `models.json` by updating existing local-file entries instead of only appending new entries.

### Task 2: Safe Local Launch

**Files:**
- Modify: `src/main/local-model-server.ts`
- Test: `tests/local-model-server.test.ts`

- [ ] Add tests that unavailable local entries cannot launch and that missing `llama-server` returns a guided error.
- [ ] Keep launch authorization tied to discovered GGUF files under configured roots.
- [ ] Return a user-actionable install hint when `llama-server` is missing.

### Task 3: UI Status

**Files:**
- Modify: `src/renderer/src/screens/Chat/types.ts`
- Modify: `src/renderer/src/screens/Chat/ModelPicker.tsx`
- Modify: `src/renderer/src/screens/Chat/hooks/useModelConfig.ts`
- Modify: `src/renderer/src/screens/Models/Models.tsx`
- Modify: `src/renderer/src/assets/main.css`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Test: `src/renderer/src/screens/Chat/hooks/useModelConfig.test.tsx`

- [ ] Propagate local model availability fields through preload and renderer types.
- [ ] Disable unavailable local models in the chat picker with a short status label.
- [ ] Show local model availability and launchability badges on model cards.

### Task 4: Mac Packaging

**Files:**
- Modify: `package.json`
- Modify: `electron-builder.yml`
- Test: `tests/packaging-config.test.ts`

- [ ] Add a packaging config test that pins app id, product name, mac artifact name, and unsigned-local build command.
- [ ] Change the mac build script to run `npm run build` first and build an unsigned local DMG without notarization by default.
- [ ] Ensure Electron Builder metadata names the app `Hermes Desktop Max` and emits a predictable DMG.

### Task 5: Verification

**Commands:**
- `npm test -- tests/local-model-files.test.ts tests/local-model-server.test.ts src/renderer/src/screens/Chat/hooks/useModelConfig.test.tsx tests/packaging-config.test.ts`
- `npm run typecheck`
- `npm run build`

**Completion criteria:**
- Local model tests pass.
- TypeScript passes.
- Production build passes.
- Final answer reports exact DMG/install commands and any build steps not run.
