# 07 - Business Logic and Core Algorithms

Generated from repository state on 2026-06-12. No secrets are included; environment-variable names are documented without values.

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
```

## Local Model Discovery Algorithm

The fork scans the two configured roots recursively, ignores macOS AppleDouble `._` files, accepts `.gguf` and `.safetensors`, and converts each file into a deterministic saved model entry. GGUF files are launchable through `llama-server`; safetensors files are discoverable but not directly launched.

```ts
   1 | import { createHash } from "crypto";
   2 | import { existsSync, readdirSync, statSync } from "fs";
   3 | import { basename, extname, join } from "path";
   4 | import { HERMES_HOME } from "./installer";
   5 | import { getLocalModelRoots, DEFAULT_LOCAL_MODEL_ROOTS } from "./config";
   6 | import type { SavedModel } from "./models";
   7 | import { safeWriteFile } from "./utils";
   8 |
   9 | export const LOCAL_MODEL_ROOTS = DEFAULT_LOCAL_MODEL_ROOTS;
  10 |
  11 | export interface LocalModelFile {
  12 |   path: string;
  13 |   root: string;
  14 |   format: "gguf" | "safetensors";
  15 |   size?: number;
  16 |   mtimeMs?: number;
  17 | }
  18 |
  19 | export interface LocalModelRootStatus {
  20 |   path: string;
  21 |   available: boolean;
  22 |   modelCount: number;
  23 | }
  24 |
  25 | export interface LocalModelScanStatus {
  26 |   createdAt: number;
  27 |   roots: LocalModelRootStatus[];
  28 |   files: LocalModelFile[];
  29 | }
  30 |
  31 | const SUPPORTED_FORMATS = new Set([".gguf", ".safetensors"]);
  32 | const DEFAULT_LOCAL_BASE_URL = "http://localhost:8080/v1";
  33 | const MIN_LOCAL_MODEL_BYTES = 1 * 1024 * 1024;
  34 | const LOCAL_MODEL_SCAN_CACHE_FILE = join(HERMES_HOME, "local-model-scan.json");
  35 | const NON_CHAT_MODEL_NAME_PATTERNS = [
  36 |   /\bembed(?:ding)?s?\b/i,
  37 |   /\bnomic[-_. ]?embed\b/i,
  38 |   /\bbge[-_. ]/i,
  39 |   /\be5[-_. ]/i,
  40 |   /\bgte[-_. ]/i,
  41 | ];
  42 |
  43 | function modelNameFromPath(path: string): string {
  44 |   const withoutExt = basename(path, extname(path));
  45 |   return (
  46 |     "Local " + withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  47 |   );
  48 | }
  49 |
  50 | function stableLocalModelId(path: string): string {
  51 |   return `local-file-${createHash("sha1").update(path).digest("hex").slice(0, 16)}`;
  52 | }
  53 |
  54 | export function isLikelyChatLocalModelFile(path: string): boolean {
  55 |   const name = basename(path, extname(path)).replace(/[_-]+/g, " ");
  56 |   return !NON_CHAT_MODEL_NAME_PATTERNS.some((pattern) => pattern.test(name));
  57 | }
  58 |
  59 | export function discoverLocalModelFiles(
  60 |   roots: string[] = getLocalModelRoots(),
  61 | ): LocalModelFile[] {
  62 |   const found: LocalModelFile[] = [];
  63 |
  64 |   function visit(root: string, dir: string): void {
  65 |     let entries;
  66 |     try {
  67 |       entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
  68 |         a.name.localeCompare(b.name),
  69 |       );
  70 |     } catch {
  71 |       return;
  72 |     }
  73 |
  74 |     for (const entry of entries) {
  75 |       if (entry.name.startsWith("._")) continue;
  76 |       const entryPath = join(dir, entry.name);
  77 |       if (entry.isDirectory()) {
  78 |         visit(root, entryPath);
```

## Local Model Server Algorithm

The launcher only starts a `.gguf` file that was discovered under the configured roots. It writes PID, model, port, and log state files under `HERMES_HOME`, starts at port `8080`, searches through `8099`, checks health at `http://127.0.0.1:<port>/v1/models`, and uses `llama-server` from Homebrew, `/usr/local/bin`, or PATH.

```ts
 126 |   port = LOCAL_MODEL_SERVER_PORT,
 127 | ): string[] {
 128 |   return [
 129 |     "--model",
 130 |     modelPath,
 131 |     "--host",
 132 |     "127.0.0.1",
 133 |     "--port",
 134 |     String(port),
 135 |     "--alias",
 136 |     modelPath,
 137 |     "--ctx-size",
 138 |     String(LOCAL_MODEL_SERVER_CONTEXT_SIZE),
 139 |     "--no-warmup",
 140 |   ];
 141 | }
 142 |
 143 | export function resolveLlamaServerCommand(
 144 |   fileExists: (path: string) => boolean = existsSync,
 145 | ): string {
 146 |   for (const candidate of LLAMA_SERVER_CANDIDATES) {
 147 |     if (fileExists(candidate)) return candidate;
 148 |   }
 149 |   return "llama-server";
 150 | }
 151 |
 152 | function commandAvailable(command: string): boolean {
 153 |   if (command.includes("/") && existsSync(command)) return true;
 154 |   const result = spawnSync(
 155 |     process.platform === "win32" ? "where" : "which",
 156 |     [command],
 157 |     {
 158 |       encoding: "utf8",
 159 |       env: { ...process.env, PATH: getEnhancedPath() },
 160 |       timeout: 5000,
 161 |       windowsHide: true,
 162 |     },
 163 |   );
 164 |   return result.status === 0;
 165 | }
 166 |
 167 | export function getLocalModelRuntimeStatus(
 168 |   fileExists: (path: string) => boolean = existsSync,
 169 |   commandIsAvailable: (command: string) => boolean = commandAvailable,
 170 | ): LocalModelRuntimeStatus {
 171 |   const command = resolveLlamaServerCommand(fileExists);
 172 |   const available =
 173 |     command.includes("/") && fileExists(command)
 174 |       ? true
 175 |       : commandIsAvailable(command);
 176 |   return {
 177 |     llamaServerAvailable: available,
 178 |     llamaServerPath: available ? command : null,
 179 |     installHint: available ? null : LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT,
 180 |   };
 181 | }
 182 |
 183 | function readPid(): number | null {
 184 |   try {
 185 |     if (!existsSync(PID_FILE)) return null;
 186 |     const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
 187 |     return Number.isFinite(pid) ? pid : null;
 188 |   } catch {
 189 |     return null;
 190 |   }
 191 | }
 192 |
 193 | function readModelPath(): string | null {
 194 |   try {
 195 |     if (!existsSync(MODEL_FILE)) return null;
 196 |     return readFileSync(MODEL_FILE, "utf-8").trim() || null;
 197 |   } catch {
 198 |     return null;
 199 |   }
 200 | }
 201 |
 202 | function readPort(): number | null {
 203 |   try {
 204 |     if (!existsSync(PORT_FILE)) return null;
 205 |     const port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
 206 |     return Number.isInteger(port) && port > 0 ? port : null;
 207 |   } catch {
 208 |     return null;
 209 |   }
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
  46 |   return join(HERMES_HOME, "desktop.json");
  47 | }
  48 |
  49 | export function getPaperclipNpmCacheDir(): string {
  50 |   return join(HERMES_HOME, "paperclip-npm-cache");
  51 | }
  52 |
  53 | function paperclipLogFile(): string {
  54 |   return join(HERMES_HOME, "paperclip.log");
  55 | }
  56 |
  57 | function ensurePaperclipRuntimeDirs(): void {
  58 |   mkdirSync(getPaperclipNpmCacheDir(), { recursive: true });
  59 | }
  60 |
  61 | function appendPaperclipLog(chunk: Buffer | string): void {
  62 |   try {
  63 |     if (!existsSync(HERMES_HOME)) {
  64 |       mkdirSync(HERMES_HOME, { recursive: true });
  65 |     }
  66 |     appendFileSync(paperclipLogFile(), chunk);
  67 |   } catch {
  68 |     // Logging must not block sidecar startup.
  69 |   }
  70 | }
  71 |
  72 | function readDesktopConfig(): Record<string, unknown> {
  73 |   try {
  74 |     const file = desktopConfigFile();
  75 |     if (!existsSync(file)) return {};
  76 |     return JSON.parse(readFileSync(file, "utf-8"));
  77 |   } catch {
  78 |     return {};
  79 |   }
  80 | }
  81 |
  82 | function writeDesktopConfig(data: Record<string, unknown>): void {
  83 |   if (!existsSync(HERMES_HOME)) {
  84 |     mkdirSync(HERMES_HOME, { recursive: true });
  85 |   }
  86 |   writeFileSync(desktopConfigFile(), JSON.stringify(data, null, 2), "utf-8");
  87 | }
  88 |
  89 | export function normalizePaperclipUrl(input: string): string {
  90 |   const trimmed = input.trim();
  91 |   if (!trimmed) return DEFAULT_PAPERCLIP_URL;
  92 |   const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
  93 |     ? trimmed
  94 |     : `http://${trimmed}`;
  95 |   try {
  96 |     const parsed = new URL(withProtocol);
  97 |     if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
  98 |       return DEFAULT_PAPERCLIP_URL;
  99 |     }
 100 |     return withProtocol.replace(/\/+$/, "");
 101 |   } catch {
 102 |     return DEFAULT_PAPERCLIP_URL;
 103 |   }
 104 | }
 105 |
 106 | export function readPaperclipConfigFromData(
 107 |   data: Record<string, unknown>,
 108 | ): PaperclipConfig {
 109 |   const raw =
 110 |     data.paperclip && typeof data.paperclip === "object"
 111 |       ? (data.paperclip as Record<string, unknown>)
 112 |       : {};
 113 |
 114 |   return {
 115 |     serverUrl: normalizePaperclipUrl(
 116 |       typeof raw.serverUrl === "string" ? raw.serverUrl : "",
 117 |     ),
 118 |     autoStart: typeof raw.autoStart === "boolean" ? raw.autoStart : true,
 119 |     telemetryDisabled:
 120 |       typeof raw.telemetryDisabled === "boolean" ? raw.telemetryDisabled : true,
```

## YAML Path Logic

`src/main/config.ts` contains dotted YAML path readers/writers that avoid flat-key leaks and restrict environment variable names. This is critical because renderer UI writes paths such as `agent.service_tier` and `memory.provider`.

## Areas for Review

- Should local model scanning be asynchronous with cancellation to avoid blocking startup on very large model folders?
- Should child-process lifecycle management be centralized for gateway, local model server, Paperclip, Claw3d, and install tasks?
- Should provider key resolution be data-driven from `constants.ts` instead of duplicated in renderer/main?
