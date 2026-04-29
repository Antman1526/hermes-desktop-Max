# Windows and OpenChronicle Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Windows-aware Hermes Agent runtime helpers and expose OpenChronicle as a memory/MCP provider in Hermes Agent Desktop.

**Architecture:** Keep the existing Electron app structure. Add platform-aware helper functions in `src/main/installer.ts`, add OpenChronicle memory-provider metadata/config helpers, wire activation through IPC/preload, and update the Memory screen to use the new activation API.

**Tech Stack:** Electron, TypeScript, React, Vitest, Hermes Agent config YAML text updates.

---

### Task 1: Platform-Aware Hermes Runtime Helpers

**Files:**

- Modify: `src/main/installer.ts`
- Modify: `tests/installer-utils.test.ts`

- [ ] Add exported helpers:
  - `pathListSeparator(platform = process.platform)`
  - `hermesPythonPath(platform = process.platform)`
  - `hermesVenvBinPath(platform = process.platform)`

- [ ] Replace direct `HERMES_PYTHON` usage in `installer.ts` with `hermesPythonPath()` where runtime checks or subprocess calls need the current platform path.

- [ ] Update `getEnhancedPath()` to use `pathListSeparator()` and include Windows venv/Scripts and common Windows user bin locations.

- [ ] Add Vitest tests for Windows and Unix path behavior.

### Task 2: OpenChronicle Provider Metadata

**Files:**

- Modify: `src/main/installer.ts`
- Modify: `src/renderer/src/screens/Memory/Memory.tsx`
- Modify: `src/shared/i18n/locales/en/memory.ts`
- Modify: `src/shared/i18n/locales/zh-CN/memory.ts`
- Modify: `tests/installer-utils.test.ts`

- [ ] Add `openchronicle` to known memory provider metadata.

- [ ] Add `OPENCHRONICLE_MCP_URL` env field.

- [ ] Add provider URL to the Memory screen.

- [ ] Add i18n copy for English and Chinese.

- [ ] Add tests proving metadata includes OpenChronicle.

### Task 3: OpenChronicle Activation Config

**Files:**

- Modify: `src/main/installer.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/src/screens/Memory/Memory.tsx`
- Modify: `tests/ipc-handlers.test.ts`
- Modify: `tests/preload-api-surface.test.ts`
- Modify: `tests/installer-utils.test.ts`

- [ ] Add `configureMemoryProvider(provider, profile?)` in the main process.

- [ ] When provider is `openchronicle`, ensure `OPENCHRONICLE_MCP_URL` defaults to `http://127.0.0.1:8742/mcp`.

- [ ] When provider is `openchronicle`, ensure `mcp_servers.openchronicle` is present in `config.yaml` with URL and enabled state.

- [ ] Add an IPC/preload method for memory provider activation.

- [ ] Update Memory screen activation/deactivation to use the new method.

- [ ] Add tests for IPC/preload consistency and OpenChronicle config output.

### Task 4: Verification

**Files:**

- No source changes expected.

- [ ] Run `npm test`.

- [ ] Run `npm run typecheck`.

- [ ] Report any remaining limitations, especially that OpenChronicle capture is macOS-only and Windows can only connect to a reachable endpoint.
