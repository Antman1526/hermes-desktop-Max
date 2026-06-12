# 04 - Backend API Specifications

Generated from repository state on 2026-06-12. No secrets are included; environment-variable names are documented without values.

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
  35 | } from "./ssh-tunnel";
  36 | import {
  37 |   pidIsAliveAs,
  38 |   stripAnsi,
  39 |   profileHome,
  40 |   getActiveProfileNameSync,
  41 | } from "./utils";
  42 | import { readModels } from "./models";
  43 | import { HIDDEN_SUBPROCESS_OPTIONS } from "./process-options";
  44 | import { type Attachment, escapeXmlAttr } from "../shared/attachments";
  45 |
  46 | const LOCAL_API_URL = "http://127.0.0.1:8642";
  47 | const DIRECT_LOCAL_MODEL_REQUEST_TIMEOUT_MS = 300_000;
  48 |
  49 | /**
  50 |  * Normalise a remote-mode URL the user typed into the connection
  51 |  * settings.  Strips trailing slashes and, importantly, a trailing
  52 |  * `/v1` segment — callers append `/v1/<path>` themselves, so leaving
  53 |  * the user's `/v1` would produce `http://host/v1/v1/chat/completions`
  54 |  * → 404.  Reported as #266 (multiple users entered the URL "with
  55 |  * /v1" because the gateway's curl examples show that form).
  56 |  *
  57 |  * Also tolerates trailing whitespace and the rare `/v1/` (slash-suffixed)
  58 |  * form.  Returns the cleaned string.
  59 |  */
  60 | export function normaliseRemoteUrl(raw: string): string {
  61 |   let url = (raw || "").trim();
  62 |   // Strip trailing slashes
  63 |   url = url.replace(/\/+$/, "");
  64 |   // Strip trailing `/v1` (callers append /v1/<path> themselves)
  65 |   url = url.replace(/\/v1$/i, "");
  66 |   return url;
  67 | }
  68 |
  69 | export function getApiUrl(): string {
  70 |   const conn = getConnectionConfig();
  71 |   if (conn.mode === "ssh") {
  72 |     const sshUrl = getSshTunnelUrl();
  73 |     if (!sshUrl) throw new Error("SSH tunnel is not active");
  74 |     return normaliseRemoteUrl(sshUrl);
  75 |   }
  76 |   if (conn.mode === "remote" && conn.remoteUrl) {
  77 |     return normaliseRemoteUrl(conn.remoteUrl);
  78 |   }
  79 |   return LOCAL_API_URL;
  80 | }
  81 |
  82 | export function isRemoteMode(): boolean {
  83 |   const mode = getConnectionConfig().mode;
  84 |   return mode === "remote" || mode === "ssh";
  85 | }
  86 |
  87 | /** True only for pure remote HTTP — SSH tunnel has full local access via SSH exec */
  88 | export function isRemoteOnlyMode(): boolean {
  89 |   return getConnectionConfig().mode === "remote";
  90 | }
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
