# 07 - Business Logic and Core Algorithms

Generated from repository state on 2026-06-03. No secrets are included; environment-variable names are documented without values.

## Install and Runtime Orchestration

The installer module resolves `HERMES_HOME`, Hermes repo path, Python path, enhanced PATH, install target state, API key mappings, memory providers, backups, imports, doctor, update, and log reading. It is the main compatibility layer between Electron and Hermes Agent.

## Chat Routing Algorithm

1. Resolve active connection mode: local, remote, or SSH.
2. Normalize the base URL, stripping trailing slashes and duplicate `/v1`.
3. Ensure SSH tunnel is active when required.
4. Read active model config and provider env.
5. For OpenAI-compatible providers, set `OPENAI_BASE_URL` and matching key.
6. Prefer HTTP streaming fast path when API server is ready.
7. Fall back to Hermes CLI spawning when necessary.

URL normalization:

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
```

## Local Model Discovery Algorithm

The fork scans the two configured roots recursively, ignores macOS AppleDouble `._` files, accepts `.gguf` and `.safetensors`, and converts each file into a deterministic saved model entry. GGUF files are launchable through `llama-server`; safetensors files are discoverable but not directly launched.

```ts
   1 | import { createHash } from "crypto";
   2 | import { existsSync, readdirSync } from "fs";
   3 | import { basename, extname, join } from "path";
   4 | import { homedir } from "os";
   5 | import type { SavedModel } from "./models";
   6 |
   7 | export const LOCAL_MODEL_ROOTS = [
   8 |   "/Volumes/MainStore/Development/AI_Models",
   9 |   join(homedir(), "Desktop", "AI_Models"),
  10 | ];
  11 |
  12 | export interface LocalModelFile {
  13 |   path: string;
  14 |   root: string;
  15 |   format: "gguf" | "safetensors";
  16 | }
  17 |
  18 | const SUPPORTED_FORMATS = new Set([".gguf", ".safetensors"]);
  19 | const DEFAULT_LOCAL_BASE_URL = "http://localhost:8080/v1";
  20 |
  21 | function modelNameFromPath(path: string): string {
  22 |   const withoutExt = basename(path, extname(path));
  23 |   return (
  24 |     "Local " + withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  25 |   );
  26 | }
  27 |
  28 | function stableLocalModelId(path: string): string {
  29 |   return `local-file-${createHash("sha1").update(path).digest("hex").slice(0, 16)}`;
  30 | }
  31 |
  32 | export function discoverLocalModelFiles(
  33 |   roots: string[] = LOCAL_MODEL_ROOTS,
  34 | ): LocalModelFile[] {
  35 |   const found: LocalModelFile[] = [];
  36 |
  37 |   function visit(root: string, dir: string): void {
  38 |     let entries;
  39 |     try {
  40 |       entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
  41 |         a.name.localeCompare(b.name),
  42 |       );
  43 |     } catch {
  44 |       return;
  45 |     }
  46 |
  47 |     for (const entry of entries) {
  48 |       if (entry.name.startsWith("._")) continue;
  49 |       const entryPath = join(dir, entry.name);
  50 |       if (entry.isDirectory()) {
  51 |         visit(root, entryPath);
  52 |         continue;
  53 |       }
  54 |       if (!entry.isFile()) continue;
  55 |
  56 |       const ext = extname(entry.name).toLowerCase();
  57 |       if (!SUPPORTED_FORMATS.has(ext)) continue;
  58 |       found.push({
  59 |         path: entryPath,
  60 |         root,
  61 |         format: ext.slice(1) as LocalModelFile["format"],
  62 |       });
  63 |     }
  64 |   }
  65 |
  66 |   for (const root of roots) {
  67 |     if (existsSync(root)) visit(root, root);
  68 |   }
  69 |
  70 |   return found;
  71 | }
  72 |
  73 | export function buildLocalModelEntries(files: LocalModelFile[]): SavedModel[] {
  74 |   return files.map((file) => ({
  75 |     id: stableLocalModelId(file.path),
  76 |     name: modelNameFromPath(file.path),
  77 |     provider: "custom",
  78 |     model: file.path,
```

## Local Model Server Algorithm

The launcher only starts a `.gguf` file that was discovered under the configured roots. It writes PID and model state files under `HERMES_HOME`, checks health at `http://127.0.0.1:8080/v1/models`, and uses `llama-server` from Homebrew, `/usr/local/bin`, or PATH.

```ts
 126 |         resolve(Boolean(res.statusCode && res.statusCode < 500));
 127 |         res.resume();
 128 |       },
 129 |     );
 130 |     req.on("error", () => resolve(false));
 131 |     req.on("timeout", () => {
 132 |       req.destroy();
 133 |       resolve(false);
 134 |     });
 135 |     req.end();
 136 |   });
 137 | }
 138 |
 139 | export async function waitForLocalModelServerReady({
 140 |   timeoutMs = SERVER_START_TIMEOUT_MS,
 141 |   intervalMs = SERVER_START_POLL_MS,
 142 |   healthCheck = serverHealth,
 143 | }: {
 144 |   timeoutMs?: number;
 145 |   intervalMs?: number;
 146 |   healthCheck?: () => Promise<boolean>;
 147 | } = {}): Promise<boolean> {
 148 |   const deadline = Date.now() + timeoutMs;
 149 |   do {
 150 |     if (await healthCheck()) return true;
 151 |     await new Promise((resolve) => setTimeout(resolve, intervalMs));
 152 |   } while (Date.now() < deadline);
 153 |   return healthCheck();
 154 | }
 155 |
 156 | export async function getLocalModelServerStatus(): Promise<LocalModelServerStatus> {
 157 |   const launcherPath = resolveLlamaServerCommand();
 158 |   const launcherAvailable = commandAvailable(launcherPath);
 159 |   const pid = readPid();
 160 |   const managed = Boolean(pid && pidIsAlive(pid));
 161 |   const running = await serverHealth();
 162 |   if (pid && !managed && !running) clearStateFiles();
 163 |
 164 |   return {
 165 |     running,
 166 |     managed,
 167 |     launcherAvailable,
 168 |     launcherPath: launcherAvailable ? launcherPath : null,
 169 |     modelPath: managed ? readModelPath() : null,
 170 |     baseUrl: LOCAL_MODEL_SERVER_BASE_URL,
 171 |     pid: managed ? pid : null,
 172 |   };
 173 | }
 174 |
 175 | export async function startLocalModelServer(
 176 |   modelPath: string,
 177 | ): Promise<LocalModelServerStatus> {
 178 |   if (!isLaunchableLocalModel(modelPath)) {
 179 |     return {
 180 |       ...(await getLocalModelServerStatus()),
 181 |       error: "Only GGUF model files can be launched with llama-server.",
 182 |     };
 183 |   }
 184 |   if (!isDiscoveredLocalModelPath(modelPath)) {
 185 |     return {
 186 |       ...(await getLocalModelServerStatus()),
 187 |       error: "Model file is not in a configured local model folder.",
 188 |     };
 189 |   }
 190 |   if (!existsSync(modelPath)) {
 191 |     return {
 192 |       ...(await getLocalModelServerStatus()),
 193 |       error: `Model file does not exist: ${modelPath}`,
 194 |     };
 195 |   }
 196 |
 197 |   const current = await getLocalModelServerStatus();
 198 |   if (current.running && current.modelPath === modelPath) return current;
 199 |   if (current.managed && current.modelPath !== modelPath) {
 200 |     stopLocalModelServer();
 201 |   }
 202 |
 203 |   const command = resolveLlamaServerCommand();
 204 |   if (!commandAvailable(command)) {
 205 |     return {
 206 |       ...current,
 207 |       launcherAvailable: false,
 208 |       launcherPath: null,
 209 |       error: "llama-server was not found on PATH.",
```

## Session Cache Algorithm

Session sync uses a last-sync window, O(1) Map merges, and chunked stale count refresh to avoid O(N2) behavior with large histories.

```ts
  82 | function writeCache(data: CacheData): void {
  83 |   try {
  84 |     safeWriteFile(cacheFilePath(), JSON.stringify(data));
  85 |   } catch {
  86 |     // non-fatal
  87 |   }
  88 | }
  89 |
  90 | function getDb(): Database.Database | null {
  91 |   const dbPath = activeStateDbPath();
  92 |   if (!existsSync(dbPath)) return null;
  93 |   return new Database(dbPath, { readonly: true });
  94 | }
  95 |
  96 | // Sync from hermes DB to local cache — only fetches new/updated sessions
  97 | export function syncSessionCache(): CachedSession[] {
  98 |   const cache = readCache();
  99 |   const db = getDb();
 100 |   if (!db) return cache.sessions;
 101 |
 102 |   try {
 103 |     // Fetch sessions newer than last sync, or all if first sync
 104 |     const rows = db
 105 |       .prepare(
 106 |         `SELECT s.id, s.started_at, s.source, s.message_count, s.model, s.title
 107 |          FROM sessions s
 108 |          WHERE s.started_at > ?
 109 |          ORDER BY s.started_at DESC`,
 110 |       )
 111 |       .all(cache.lastSync > 0 ? cache.lastSync - 300 : 0) as Array<{
 112 |       id: string;
 113 |       started_at: number;
 114 |       source: string;
 115 |       message_count: number;
 116 |       model: string;
 117 |       title: string | null;
 118 |     }>;
 119 |
 120 |     // Index existing sessions by id once so the per-row update below is
 121 |     // O(1) instead of O(N). Without this, syncing N existing sessions
 122 |     // against N new rows is O(N²) and visibly slows app startup once a
 123 |     // user has accumulated thousands of sessions (issue #16).
 124 |     const existingById = new Map<string, CachedSession>();
 125 |     for (const s of cache.sessions) existingById.set(s.id, s);
 126 |     const newSessions: CachedSession[] = [];
 127 |
 128 |     const refreshedIds = new Set<string>();
 129 |     for (const row of rows) {
 130 |       refreshedIds.add(row.id);
 131 |       const existing = existingById.get(row.id);
 132 |       if (existing) {
 133 |         existing.messageCount = row.message_count;
 134 |         if (row.model) existing.model = row.model;
 135 |         if (row.title) existing.title = row.title;
 136 |         continue;
 137 |       }
 138 |
 139 |       let title = row.title || "";
 140 |       if (!title) {
 141 |         try {
 142 |           const msg = db
 143 |             .prepare(
 144 |               `SELECT content FROM messages
 145 |                WHERE session_id = ? AND role = 'user' AND content IS NOT NULL
 146 |                ORDER BY timestamp, id LIMIT 1`,
 147 |             )
 148 |             .get(row.id) as { content: string } | undefined;
 149 |           title = msg
 150 |             ? generateTitle(msg.content)
 151 |             : t("sessions.newConversation", getAppLocale());
 152 |         } catch {
 153 |           title = t("sessions.newConversation", getAppLocale());
 154 |         }
 155 |       }
 156 |
 157 |       newSessions.push({
 158 |         id: row.id,
 159 |         title,
 160 |         startedAt: row.started_at,
 161 |         source: row.source,
 162 |         messageCount: row.message_count,
 163 |         model: row.model || "",
 164 |       });
 165 |     }
 166 |
 167 |     // Phase 2: refresh message_count for cached sessions that weren't
 168 |     // returned by the lastSync-windowed query above. Without this, an
 169 |     // old session that's still accumulating messages keeps the stale
 170 |     // count it had at first sync — the renderer reads from the cache,
 171 |     // so the UI reports e.g. 15 messages when the conversation actually
 172 |     // has 200+. Issue #226. Cheap (single column, no joins, batched IN
 173 |     // clause), and skipped entirely on a first sync since cache.sessions
 174 |     // is empty.
 175 |     const staleIds = cache.sessions
 176 |       .map((s) => s.id)
 177 |       .filter((id) => !refreshedIds.has(id));
 178 |     if (staleIds.length > 0) {
 179 |       // SQLite caps prepared-statement parameters; chunk well under
 180 |       // SQLITE_MAX_VARIABLE_NUMBER (default 999 on older builds) for
 181 |       // portability across the better-sqlite3 versions hermes ships.
 182 |       const CHUNK = 500;
 183 |       const countsById = new Map<string, number>();
 184 |       for (let i = 0; i < staleIds.length; i += CHUNK) {
 185 |         const chunk = staleIds.slice(i, i + CHUNK);
 186 |         const placeholders = chunk.map(() => "?").join(", ");
 187 |         const refreshed = db
 188 |           .prepare(
 189 |             `SELECT id, message_count FROM sessions WHERE id IN (${placeholders})`,
 190 |           )
```

## Paperclip Sidecar Algorithm

Paperclip config normalizes URLs, validates health, checks `paperclipai` or `npx`, and starts `npx paperclipai run` with telemetry disabled by default.

```ts
  46 |
  47 | export function normalizePaperclipUrl(input: string): string {
  48 |   const trimmed = input.trim();
  49 |   if (!trimmed) return DEFAULT_PAPERCLIP_URL;
  50 |   const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
  51 |     ? trimmed
  52 |     : `http://${trimmed}`;
  53 |   try {
  54 |     const parsed = new URL(withProtocol);
  55 |     if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
  56 |       return DEFAULT_PAPERCLIP_URL;
  57 |     }
  58 |     return withProtocol.replace(/\/+$/, "");
  59 |   } catch {
  60 |     return DEFAULT_PAPERCLIP_URL;
  61 |   }
  62 | }
  63 |
  64 | export function readPaperclipConfigFromData(
  65 |   data: Record<string, unknown>,
  66 | ): PaperclipConfig {
  67 |   const raw =
  68 |     data.paperclip && typeof data.paperclip === "object"
  69 |       ? (data.paperclip as Record<string, unknown>)
  70 |       : {};
  71 |
  72 |   return {
  73 |     serverUrl: normalizePaperclipUrl(
  74 |       typeof raw.serverUrl === "string" ? raw.serverUrl : "",
  75 |     ),
  76 |     telemetryDisabled:
  77 |       typeof raw.telemetryDisabled === "boolean" ? raw.telemetryDisabled : true,
  78 |   };
  79 | }
  80 |
  81 | export function mergePaperclipConfigData(
  82 |   data: Record<string, unknown>,
  83 |   config: Partial<PaperclipConfig>,
  84 | ): Record<string, unknown> {
  85 |   const current = readPaperclipConfigFromData(data);
  86 |   return {
  87 |     ...data,
  88 |     paperclip: {
  89 |       serverUrl: normalizePaperclipUrl(config.serverUrl ?? current.serverUrl),
  90 |       telemetryDisabled: config.telemetryDisabled ?? current.telemetryDisabled,
  91 |     },
  92 |   };
  93 | }
  94 |
  95 | export function getPaperclipConfig(): PaperclipConfig {
  96 |   return readPaperclipConfigFromData(readDesktopConfig());
  97 | }
  98 |
  99 | export function setPaperclipConfig(
 100 |   config: Partial<PaperclipConfig>,
 101 | ): PaperclipConfig {
 102 |   const nextData = mergePaperclipConfigData(readDesktopConfig(), config);
 103 |   writeDesktopConfig(nextData);
 104 |   return readPaperclipConfigFromData(nextData);
 105 | }
 106 |
 107 | function requestHealth(url: string): Promise<boolean> {
 108 |   return new Promise((resolve) => {
 109 |     const healthUrl = `${normalizePaperclipUrl(url)}/health`;
 110 |     const mod = healthUrl.startsWith("https") ? https : http;
 111 |     const req = mod.request(
 112 |       healthUrl,
 113 |       { method: "GET", timeout: 1500 },
 114 |       (res) => {
 115 |         resolve(
 116 |           Boolean(
 117 |             res.statusCode && res.statusCode >= 200 && res.statusCode < 500,
 118 |           ),
 119 |         );
 120 |         res.resume();
```

## YAML Path Logic

`src/main/config.ts` contains dotted YAML path readers/writers that avoid flat-key leaks and restrict environment variable names. This is critical because renderer UI writes paths such as `agent.service_tier` and `memory.provider`.

## Areas for Review

- Should local model scanning be asynchronous with cancellation to avoid blocking startup on very large model folders?
- Should child-process lifecycle management be centralized for gateway, local model server, Paperclip, Claw3d, and install tasks?
- Should provider key resolution be data-driven from `constants.ts` instead of duplicated in renderer/main?
