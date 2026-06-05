# Personal Local Model Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal-use Settings control center for local model folders, scan status, and `llama-server` runtime readiness.

**Architecture:** Store configurable local model roots in `desktop.json`, use those roots for discovery/reconciliation, expose scan/runtime status through preload IPC, and render a compact Local Models section in Settings. Keep the existing GGUF launch path through `llama-server` and avoid a broad IPC refactor in this pass.

**Tech Stack:** Electron main/preload IPC, TypeScript, React 19, Vitest, Node fs/path/os APIs.

---

### Task 1: Persist Local Model Roots

**Files:**

- Modify: `src/main/config.ts`
- Test: `tests/local-model-settings.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/local-model-settings.test.ts`:

```ts
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const TEST_HOME = join(tmpdir(), `hermes-local-settings-${Date.now()}`);

vi.mock("../src/main/installer", () => ({
  HERMES_HOME: TEST_HOME,
  expectedEnvKeyForModel: () => "OPENAI_API_KEY",
}));

describe("local model root settings", () => {
  beforeEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    mkdirSync(TEST_HOME, { recursive: true });
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
  });

  it("uses Antman's personal defaults when no roots are configured", async () => {
    const { getLocalModelRoots, DEFAULT_LOCAL_MODEL_ROOTS } =
      await import("../src/main/config");

    expect(getLocalModelRoots()).toEqual(DEFAULT_LOCAL_MODEL_ROOTS);
  });

  it("trims and deduplicates configured roots", async () => {
    const { getLocalModelRoots, setLocalModelRoots } =
      await import("../src/main/config");

    setLocalModelRoots([" /tmp/models ", "/tmp/models", "", " /other "]);

    expect(getLocalModelRoots()).toEqual(["/tmp/models", "/other"]);
  });

  it("falls back to defaults when saved roots are empty", async () => {
    const {
      getLocalModelRoots,
      setLocalModelRoots,
      DEFAULT_LOCAL_MODEL_ROOTS,
    } = await import("../src/main/config");

    setLocalModelRoots(["", "   "]);

    expect(getLocalModelRoots()).toEqual(DEFAULT_LOCAL_MODEL_ROOTS);
  });
});
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/local-model-settings.test.ts
```

Expected: fail because `getLocalModelRoots`, `setLocalModelRoots`, and `DEFAULT_LOCAL_MODEL_ROOTS` do not exist.

- [ ] **Step 3: Implement settings helpers**

In `src/main/config.ts`, add:

```ts
export const DEFAULT_LOCAL_MODEL_ROOTS = [
  "/Volumes/MainStore/Development/AI_Models",
  join(homedir(), "Desktop", "AI_Models"),
];

export function sanitizeLocalModelRoots(roots: unknown): string[] {
  if (!Array.isArray(roots)) return [...DEFAULT_LOCAL_MODEL_ROOTS];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const root of roots) {
    if (typeof root !== "string") continue;
    const trimmed = root.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result.length > 0 ? result : [...DEFAULT_LOCAL_MODEL_ROOTS];
}

export function getLocalModelRoots(): string[] {
  return sanitizeLocalModelRoots(readDesktopConfig().localModelRoots);
}

export function setLocalModelRoots(roots: string[]): string[] {
  const data = readDesktopConfig();
  const next = sanitizeLocalModelRoots(roots);
  data.localModelRoots = next;
  writeDesktopConfig(data);
  return next;
}

export function resetLocalModelRoots(): string[] {
  return setLocalModelRoots(DEFAULT_LOCAL_MODEL_ROOTS);
}
```

- [ ] **Step 4: Verify green**

Run:

```bash
npm test -- tests/local-model-settings.test.ts
```

Expected: pass.

### Task 2: Scan Status and Runtime Status APIs

**Files:**

- Modify: `src/main/local-model-files.ts`
- Modify: `src/main/local-model-server.ts`
- Modify: `tests/local-model-files.test.ts`
- Modify: `tests/local-model-server.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests asserting:

```ts
expect(getLocalModelScanStatus([mountedRoot, missingRoot]).roots).toEqual([
  expect.objectContaining({
    path: mountedRoot,
    available: true,
    modelCount: 1,
  }),
  expect.objectContaining({
    path: missingRoot,
    available: false,
    modelCount: 0,
  }),
]);
```

And:

```ts
expect(getLocalModelRuntimeStatus(() => false)).toEqual(
  expect.objectContaining({
    llamaServerAvailable: false,
    llamaServerPath: null,
    installHint: LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT,
  }),
);
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/local-model-files.test.ts tests/local-model-server.test.ts
```

Expected: fail because the new functions do not exist.

- [ ] **Step 3: Implement scan/runtime status**

Add `LocalModelScanStatus`, `getLocalModelScanStatus`, and `rescanLocalModels` in `src/main/local-model-files.ts`.

Add `LocalModelRuntimeStatus` and `getLocalModelRuntimeStatus` in `src/main/local-model-server.ts`.

- [ ] **Step 4: Verify green**

Run:

```bash
npm test -- tests/local-model-files.test.ts tests/local-model-server.test.ts
```

Expected: pass.

### Task 3: IPC and Preload Surface

**Files:**

- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `tests/preload-api-surface.test.ts`
- Modify: `tests/ipc-handlers.test.ts`

- [ ] **Step 1: Write failing tests**

Assert the new preload methods exist:

```ts
expect(apiNames).toContain("getLocalModelSettings");
expect(apiNames).toContain("setLocalModelRoots");
expect(apiNames).toContain("resetLocalModelRoots");
expect(apiNames).toContain("rescanLocalModels");
expect(apiNames).toContain("localModelRuntimeStatus");
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/preload-api-surface.test.ts tests/ipc-handlers.test.ts
```

Expected: fail because methods/channels do not exist.

- [ ] **Step 3: Implement IPC and types**

Add handlers:

- `get-local-model-settings`
- `set-local-model-roots`
- `reset-local-model-roots`
- `rescan-local-models`
- `local-model-runtime-status`

Expose matching preload methods and ambient types.

- [ ] **Step 4: Verify green**

Run:

```bash
npm test -- tests/preload-api-surface.test.ts tests/ipc-handlers.test.ts
```

Expected: pass.

### Task 4: Settings UI

**Files:**

- Modify: `src/renderer/src/screens/Settings/Settings.tsx`
- Modify: `src/renderer/src/assets/main.css`

- [ ] **Step 1: Add UI state and handlers**

Use existing settings section styles. Add local model root list, input, Browse, Add, Remove, Reset, and Rescan controls.

- [ ] **Step 2: Add status display**

Show mounted/missing root state, model counts, and `llama-server` availability.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

### Task 5: Full Verification and Packaging

**Files:**

- Existing touched files

- [ ] **Step 1: Run targeted tests**

```bash
npm test -- tests/local-model-settings.test.ts tests/local-model-files.test.ts tests/local-model-server.test.ts tests/preload-api-surface.test.ts tests/ipc-handlers.test.ts
```

- [ ] **Step 2: Run full checks**

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

- [ ] **Step 3: Build DMG**

```bash
npm run build:mac
```

- [ ] **Step 4: Commit and push**

```bash
git add .
git commit -m "Add personal local model control center"
git push origin main
```
