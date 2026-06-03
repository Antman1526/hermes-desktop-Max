# Local Model Auto-Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically launch local GGUF models on the first available localhost port starting at `8080` and persist the actual base URL into model config.

**Architecture:** Keep local model discovery unchanged. Add port allocation and strict health checking to `src/main/local-model-server.ts`, then make the Chat model selection hook use the returned `status.baseUrl` instead of the stale saved model base URL.

**Tech Stack:** TypeScript, Electron main IPC, React hooks, Vitest.

---

### Task 1: Port Allocation and Strict Health Tests

**Files:**
- Modify: `tests/local-model-server.test.ts`
- Modify: `src/main/local-model-server.ts`

- [ ] Add failing tests that verify a bindable port is selected after occupied ports and that 404 `/v1/models` responses are unhealthy.
- [ ] Implement a small `findAvailableLocalModelPort` helper using `node:net`.
- [ ] Tighten health checks to require HTTP 200 and JSON with `data: []`.

### Task 2: Persist Actual Local Model Port

**Files:**
- Modify: `src/main/local-model-server.ts`

- [ ] Add a `local-model-server-port` state file next to the PID/model files.
- [ ] Write the selected port after spawn and return `baseUrl` with that port.
- [ ] Clear the port file on stop or stale-state cleanup.

### Task 3: Renderer Config Handoff

**Files:**
- Modify: `src/renderer/src/screens/Chat/hooks/useModelConfig.ts`

- [ ] When `startLocalModelServer` succeeds, use `status.baseUrl` as the effective base URL for `setModelConfig`.
- [ ] Keep non-local provider behavior unchanged.

### Task 4: Verification

**Commands:**

```bash
./node_modules/.bin/vitest run tests/local-model-server.test.ts tests/set-model-config-base-url.test.ts src/renderer/src/screens/Chat/attachmentUtils.test.ts
npm run typecheck
npm run lint
git diff --check
```
