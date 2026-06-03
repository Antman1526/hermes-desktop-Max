# 04 - Backend API Specifications

Generated from repository state on 2026-06-03. No secrets are included; environment-variable names are documented without values.

## API Surface

Hermes Desktop exposes backend operations through Electron IPC, not a public HTTP server. The renderer calls methods on `window.hermesAPI`; preload translates them into `ipcRenderer.invoke(channel, ...args)`; main handles each channel with `ipcMain.handle`.

## Preload Bridge Pattern

```ts
  35 | const hermesAPI = {
  36 |   // Installation
  37 |   checkInstall: (): Promise<{
  38 |     installed: boolean;
  39 |     configured: boolean;
  40 |     hasApiKey: boolean;
  41 |   }> => ipcRenderer.invoke("check-install"),
  42 |
  43 |   verifyInstall: (): Promise<boolean> => ipcRenderer.invoke("verify-install"),
  44 |
  45 |   startInstall: (): Promise<{ success: boolean; error?: string }> =>
  46 |     ipcRenderer.invoke("start-install"),
  47 |
  48 |   // Pre-install inspection + "use an existing installation" (issue #272)
  49 |   inspectInstallTarget: (): Promise<{
  50 |     hermesHome: string;
  51 |     repoPath: string;
  52 |     state: "fresh" | "update" | "replace";
  53 |   }> => ipcRenderer.invoke("inspect-install-target"),
  54 |
  55 |   validateHermesHome: (dir: string): Promise<boolean> =>
  56 |     ipcRenderer.invoke("validate-hermes-home", dir),
  57 |
  58 |   adoptHermesHome: (dir: string): Promise<boolean> =>
  59 |     ipcRenderer.invoke("adopt-hermes-home", dir),
  60 |
  61 |   quitApp: (): Promise<void> => ipcRenderer.invoke("quit-app"),
  62 |
  63 |   onInstallProgress: (
  64 |     callback: (progress: {
  65 |       step: number;
  66 |       totalSteps: number;
  67 |       title: string;
  68 |       detail: string;
  69 |       log: string;
  70 |     }) => void,
  71 |   ): (() => void) => {
  72 |     const handler = (
  73 |       _event: Electron.IpcRendererEvent,
  74 |       progress: unknown,
  75 |     ): void =>
  76 |       callback(
  77 |         progress as {
  78 |           step: number;
  79 |           totalSteps: number;
  80 |           title: string;
  81 |           detail: string;
  82 |           log: string;
  83 |         },
  84 |       );
  85 |     ipcRenderer.on("install-progress", handler);
  86 |     return () => ipcRenderer.removeListener("install-progress", handler);
  87 |   },
  88 |
  89 |   // Hermes engine info
  90 |   getHermesVersion: (): Promise<string | null> =>
```

## Main IPC Registration Pattern

```ts
 407 |   ipcMain.handle("check-install", () => {
 408 |     return checkInstallStatus();
 409 |   });
 410 |
 411 |   ipcMain.handle("verify-install", () => verifyInstall());
 412 |
 413 |   ipcMain.handle("start-install", async (event) => {
 414 |     try {
 415 |       await runInstall((progress: InstallProgress) => {
 416 |         event.sender.send("install-progress", progress);
 417 |       }, mainWindow);
 418 |       return { success: true };
 419 |     } catch (err) {
 420 |       return { success: false, error: (err as Error).message };
 421 |     }
 422 |   });
 423 |
 424 |   // Pre-install inspection + "use an existing installation" (issue #272).
 425 |   ipcMain.handle("inspect-install-target", () => inspectInstallTarget());
 426 |   ipcMain.handle("validate-hermes-home", (_event, dir: string) =>
 427 |     validateHermesHome(dir),
 428 |   );
 429 |   ipcMain.handle("adopt-hermes-home", (_event, dir: string) => {
 430 |     if (!validateHermesHome(dir)) return false;
 431 |     // Persist the choice only. HERMES_HOME is resolved once at module
 432 |     // load, so the override takes effect on the next launch — the renderer
 433 |     // asks the user to restart. (An app-driven relaunch is unreliable
 434 |     // under the dev server, which is torn down with the process.)
 435 |     setHermesHomeOverride(dir);
 436 |     return true;
 437 |   });
 438 |   ipcMain.handle("quit-app", () => app.quit());
 439 |
 440 |   // Hermes engine info
 441 |   ipcMain.handle("get-hermes-version", async () => {
 442 |     const conn = getConnectionConfig();
 443 |     if (conn.mode === "ssh" && conn.ssh) return sshGetHermesVersion(conn.ssh);
 444 |     return getHermesVersion();
 445 |   });
 446 |   ipcMain.handle("refresh-hermes-version", async () => {
 447 |     const conn = getConnectionConfig();
 448 |     if (conn.mode === "ssh" && conn.ssh) return sshGetHermesVersion(conn.ssh);
 449 |     clearVersionCache();
 450 |     return getHermesVersion();
 451 |   });
 452 |   ipcMain.handle("run-hermes-doctor", () => {
 453 |     const conn = getConnectionConfig();
 454 |     if (conn.mode === "ssh" && conn.ssh) return sshRunDoctor(conn.ssh);
 455 |     return runHermesDoctor();
 456 |   });
 457 |   ipcMain.handle("run-hermes-update", async (event) => {
 458 |     try {
 459 |       const conn = getConnectionConfig();
 460 |       if (conn.mode === "ssh" && conn.ssh) {
 461 |         event.sender.send("install-progress", {
 462 |           step: 1,
 463 |           totalSteps: 1,
 464 |           title: "Updating remote Hermes Agent",
 465 |           detail: "Running hermes update over SSH...",
 466 |           log: "Running hermes update over SSH...\n",
 467 |         });
 468 |         await sshRunUpdate(conn.ssh);
 469 |         await sshStartGateway(conn.ssh);
 470 |         await startSshTunnel(conn.ssh);
```

## Domain API Groups

### Installation

| Renderer method | IPC channel | Purpose |
| --- | --- | --- |
| `checkInstall()` | `check-install` | returns installed/configured/API-key status |
| `verifyInstall()` | `verify-install` | validates Hermes installation |
| `startInstall()` | `start-install` | runs installer and emits progress |
| `inspectInstallTarget()` | `inspect-install-target` | classifies install target as fresh/update/replace |
| `adoptHermesHome(dir)` | `adopt-hermes-home` | persists selected Hermes home override |

### Chat

`sendMessage(message, profile, resumeSessionId, history, attachments, contextFolder)` invokes `send-message`. The main handler ensures local/SSH backend readiness and delegates to `sendMessage` in `src/main/hermes.ts`.

Expected response:

```ts
type ChatResponse = {
  response: string;
  sessionId?: string;
};
```

### Models

| Renderer method | IPC channel | Purpose |
| --- | --- | --- |
| `listModels()` | `list-models` | reads defaults, custom providers, and local model files |
| `addModel(name, provider, model, baseUrl)` | `add-model` | appends a model if not duplicate |
| `removeModel(id)` | `remove-model` | removes a saved model |
| `updateModel(id, fields)` | `update-model` | partial update |
| `localModelServerStatus()` | `local-model-server-status` | returns `llama-server` state |
| `startLocalModelServer(modelPath)` | `start-local-model-server` | launches discovered GGUF file |
| `stopLocalModelServer()` | `stop-local-model-server` | terminates managed server |

### Session and Cache

| Channel | Return |
| --- | --- |
| `list-sessions` | `SessionSummary[]` |
| `get-session-messages` | visible and timeline history items |
| `search-sessions` | `SearchResult[]` from FTS |
| `sync-session-cache` | cache summaries |
| `list-cached-sessions` | paged cache summaries |

### Paperclip

`get-paperclip-config`, `set-paperclip-config`, `paperclip-status`, `start-paperclip`, `stop-paperclip`, and `open-paperclip` manage a sidecar service at `http://127.0.0.1:3100` by default.

## HTTP Backend Contract to Hermes Agent

Local mode defaults to `http://127.0.0.1:8642`. Remote and SSH modes normalize configured URLs so callers append `/v1/...` exactly once.

```ts
  35 |   pidIsAliveAs,
  36 |   stripAnsi,
  37 |   profileHome,
  38 |   getActiveProfileNameSync,
  39 | } from "./utils";
  40 | import { readModels } from "./models";
  41 | import { HIDDEN_SUBPROCESS_OPTIONS } from "./process-options";
  42 | import { type Attachment, escapeXmlAttr } from "../shared/attachments";
  43 |
  44 | const LOCAL_API_URL = "http://127.0.0.1:8642";
  45 |
  46 | /**
  47 |  * Normalise a remote-mode URL the user typed into the connection
  48 |  * settings.  Strips trailing slashes and, importantly, a trailing
  49 |  * `/v1` segment — callers append `/v1/<path>` themselves, so leaving
  50 |  * the user's `/v1` would produce `http://host/v1/v1/chat/completions`
  51 |  * → 404.  Reported as #266 (multiple users entered the URL "with
  52 |  * /v1" because the gateway's curl examples show that form).
  53 |  *
  54 |  * Also tolerates trailing whitespace and the rare `/v1/` (slash-suffixed)
  55 |  * form.  Returns the cleaned string.
  56 |  */
  57 | export function normaliseRemoteUrl(raw: string): string {
  58 |   let url = (raw || "").trim();
  59 |   // Strip trailing slashes
  60 |   url = url.replace(/\/+$/, "");
  61 |   // Strip trailing `/v1` (callers append /v1/<path> themselves)
  62 |   url = url.replace(/\/v1$/i, "");
  63 |   return url;
  64 | }
  65 |
  66 | export function getApiUrl(): string {
  67 |   const conn = getConnectionConfig();
  68 |   if (conn.mode === "ssh") {
  69 |     const sshUrl = getSshTunnelUrl();
  70 |     if (!sshUrl) throw new Error("SSH tunnel is not active");
  71 |     return normaliseRemoteUrl(sshUrl);
  72 |   }
  73 |   if (conn.mode === "remote" && conn.remoteUrl) {
  74 |     return normaliseRemoteUrl(conn.remoteUrl);
  75 |   }
  76 |   return LOCAL_API_URL;
  77 | }
  78 |
  79 | export function isRemoteMode(): boolean {
  80 |   const mode = getConnectionConfig().mode;
  81 |   return mode === "remote" || mode === "ssh";
  82 | }
  83 |
  84 | /** True only for pure remote HTTP — SSH tunnel has full local access via SSH exec */
  85 | export function isRemoteOnlyMode(): boolean {
  86 |   return getConnectionConfig().mode === "remote";
  87 | }
  88 |
  89 | // Cached API key read from the remote .env when SSH tunnel starts
  90 | let _sshRemoteApiKey = "";
```

## Streaming Protocol

Chat uses Server-Sent Events compatible with OpenAI-style chat completions. The desktop parses text deltas, reasoning deltas, tool calls, tool results, token/cost metadata, and final session IDs. Abort is implemented through a main-process chat handle.

## Error Shapes

Most IPC handlers return one of:

- `boolean` success/failure.
- `{ success: boolean; error?: string }`.
- Domain object with optional `error` field, for example local model server status.

## Areas for Review

- Should IPC channels be described with generated TypeScript contracts and runtime validators?
- Should all handlers standardize on `Result<T, ErrorCode>` instead of mixed booleans and throw/catch?
- Should long-running tasks stream structured progress events rather than text chunks?
