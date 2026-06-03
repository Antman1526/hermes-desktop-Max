# 03 - Database Schema and Data Models

Generated from repository state on 2026-06-03. No secrets are included; environment-variable names are documented without values.

## Persistent Stores

Hermes Desktop uses a mixed persistence model:

- `state.db` - Hermes Agent SQLite database, read by desktop for sessions and messages.
- `desktop/sessions.json` - desktop cache of session summaries per profile.
- `models.json` - saved model entries, including local-file entries.
- `desktop.json` - desktop connection, Paperclip, SSH, and other UI-level preferences.
- `.env`, `config.yaml`, `SOUL.md`, `auth.json` - Hermes Agent/profile files.

## SQLite Tables Inferred from Desktop Queries

The desktop does not own migrations for Hermes Agent `state.db`, but it depends on these tables and columns:

### `sessions`

| Column | Type | Used by |
| --- | --- | --- |
| `id` | text | session key |
| `source` | text | source label |
| `started_at` | integer epoch seconds | sorting and cache sync |
| `ended_at` | integer/null | session summary |
| `message_count` | integer | session count and cache refresh |
| `model` | text | UI model label |
| `title` | text/null | session title |

### `messages`

| Column | Type | Used by |
| --- | --- | --- |
| `id` | integer | message identity |
| `session_id` | text | session relationship |
| `role` | text | user/assistant/tool |
| `content` | text | text or sentinel-prefixed JSON multimodal content |
| `timestamp` | integer | timeline sorting |

### `messages_fts`

FTS5 virtual table used for session search. Desktop checks for table existence before querying.

## Session Data Access

```ts
 130 |         if (typeof u === "string") url = u;
 131 |       }
 132 |       if (!url || !url.startsWith("data:image/")) continue;
 133 |       const mime = url.slice("data:".length, url.indexOf(";"));
 134 |       attachments.push({
 135 |         id: `db-${messageId}-${idx++}`,
 136 |         kind: "image",
 137 |         name: `image.${guessExtension(mime)}`,
 138 |         mime: isImageMime(mime) ? mime : "image/png",
 139 |         size: 0,
 140 |         dataUrl: url,
 141 |       });
 142 |     }
 143 |   }
 144 |   return { text: texts.join("\n\n"), attachments };
 145 | }
 146 |
 147 | function guessExtension(mime: string): string {
 148 |   switch (mime.toLowerCase()) {
 149 |     case "image/png":
 150 |       return "png";
 151 |     case "image/jpeg":
 152 |       return "jpg";
 153 |     case "image/gif":
 154 |       return "gif";
 155 |     case "image/webp":
 156 |       return "webp";
 157 |     default:
 158 |       return "bin";
 159 |   }
 160 | }
 161 |
 162 | export interface SearchResult {
 163 |   sessionId: string;
 164 |   title: string | null;
 165 |   startedAt: number;
 166 |   source: string;
 167 |   messageCount: number;
 168 |   model: string;
 169 |   snippet: string;
 170 | }
 171 |
 172 | function getDb(readonly = true): Database.Database | null {
 173 |   // Open the active profile's session DB — named profiles keep their
 174 |   // sessions under ~/.hermes/profiles/<name>/state.db (issue #311).
 175 |   const dbPath = activeStateDbPath();
 176 |   if (!existsSync(dbPath)) return null;
 177 |   return new Database(dbPath, readonly ? { readonly: true } : {});
 178 | }
 179 |
 180 | export function listSessions(limit = 30, offset = 0): SessionSummary[] {
 181 |   const db = getDb();
 182 |   if (!db) return [];
 183 |
 184 |   try {
 185 |     // Simple query without correlated subquery — titles come from session cache
 186 |     const rows = db
 187 |       .prepare(
 188 |         `SELECT
 189 |           s.id,
 190 |           s.source,
 191 |           s.started_at,
 192 |           s.ended_at,
 193 |           s.message_count,
 194 |           s.model,
 195 |           s.title
 196 |         FROM sessions s
 197 |         ORDER BY s.started_at DESC
 198 |         LIMIT ? OFFSET ?`,
 199 |       )
 200 |       .all(limit, offset) as Array<{
 201 |       id: string;
 202 |       source: string;
 203 |       started_at: number;
 204 |       ended_at: number | null;
 205 |       message_count: number;
 206 |       model: string;
 207 |       title: string | null;
 208 |     }>;
 209 |
 210 |     return rows.map((r) => ({
 211 |       id: r.id,
 212 |       source: r.source,
 213 |       startedAt: r.started_at,
 214 |       endedAt: r.ended_at,
 215 |       messageCount: r.message_count,
 216 |       model: r.model || "",
 217 |       title: r.title,
 218 |       preview: "",
 219 |     }));
 220 |   } finally {
 221 |     db.close();
 222 |   }
 223 | }
 224 |
 225 | export function searchSessions(query: string, limit = 20): SearchResult[] {
 226 |   const db = getDb();
 227 |   if (!db) return [];
 228 |
 229 |   try {
 230 |     // Check if FTS table exists
```

## Multimodal Message Decoding

Hermes Agent stores multimodal message content with a sentinel prefix `\x00json:`. Desktop decodes text and image parts into renderer attachments.

```ts
  70 |       args: string; // pretty-printed JSON when possible, otherwise raw
  71 |       timestamp: number;
  72 |     }
  73 |   | {
  74 |       kind: "tool_result";
  75 |       id: number;
  76 |       callId: string;
  77 |       name: string;
  78 |       content: string;
  79 |       timestamp: number;
  80 |       attachments?: Attachment[];
  81 |     };
  82 |
  83 | interface DecodedContent {
  84 |   text: string;
  85 |   attachments: Attachment[];
  86 | }
  87 |
  88 | /**
  89 |  * Decode the agent's `messages.content` cell.  Plain strings are returned
  90 |  * verbatim; values with the agent's JSON-prefix sentinel are unpacked into
  91 |  * a text portion (concatenated `{type:"text"}` parts) plus an attachment
  92 |  * list (reconstituted from `{type:"image_url"}` parts).  Unknown or
  93 |  * malformed shapes fall through to the raw string.
  94 |  */
  95 | export function decodeContent(raw: string, messageId: number): DecodedContent {
  96 |   if (!raw || !raw.startsWith(CONTENT_JSON_PREFIX)) {
  97 |     return { text: raw || "", attachments: [] };
  98 |   }
  99 |   let parts: unknown;
 100 |   try {
 101 |     parts = JSON.parse(raw.slice(CONTENT_JSON_PREFIX.length));
 102 |   } catch {
 103 |     return { text: raw, attachments: [] };
 104 |   }
 105 |   if (!Array.isArray(parts)) {
 106 |     return { text: typeof parts === "string" ? parts : raw, attachments: [] };
 107 |   }
 108 |
 109 |   const texts: string[] = [];
 110 |   const attachments: Attachment[] = [];
 111 |   let idx = 0;
 112 |   for (const p of parts) {
 113 |     if (typeof p === "string") {
 114 |       if (p) texts.push(p);
 115 |       continue;
 116 |     }
 117 |     if (!p || typeof p !== "object") continue;
 118 |     const type = String(
 119 |       (p as Record<string, unknown>).type || "",
 120 |     ).toLowerCase();
 121 |     if (type === "text" || type === "input_text" || type === "output_text") {
 122 |       const t = (p as Record<string, unknown>).text;
 123 |       if (typeof t === "string" && t) texts.push(t);
 124 |     } else if (type === "image_url" || type === "input_image") {
 125 |       const ref = (p as Record<string, unknown>).image_url;
 126 |       let url = "";
 127 |       if (typeof ref === "string") url = ref;
 128 |       else if (ref && typeof ref === "object") {
```

## Session Cache Model

The session cache is profile-scoped. Default profile cache lives under `~/.hermes/desktop/sessions.json`; named profiles use `~/.hermes/profiles/<name>/desktop/sessions.json`.

```ts
   1 | import { existsSync, readFileSync } from "fs";
   2 | import { join } from "path";
   3 | import {
   4 |   profileHome,
   5 |   getActiveProfileNameSync,
   6 |   activeStateDbPath,
   7 |   safeWriteFile,
   8 | } from "./utils";
   9 | import Database from "better-sqlite3";
  10 | import { t } from "../shared/i18n";
  11 | import { getAppLocale } from "./locale";
  12 |
  13 | /**
  14 |  * The session cache lives alongside its own profile's data so profiles
  15 |  * don't share a single cache file. The default profile keeps
  16 |  * ~/.hermes/desktop/sessions.json; named profiles use
  17 |  * ~/.hermes/profiles/<name>/desktop/sessions.json (issue #311).
  18 |  */
  19 | function cacheFilePath(): string {
  20 |   return join(
  21 |     profileHome(getActiveProfileNameSync()),
  22 |     "desktop",
  23 |     "sessions.json",
  24 |   );
  25 | }
  26 |
  27 | export interface CachedSession {
  28 |   id: string;
  29 |   title: string;
  30 |   startedAt: number;
  31 |   source: string;
  32 |   messageCount: number;
  33 |   model: string;
  34 | }
  35 |
  36 | interface CacheData {
  37 |   sessions: CachedSession[];
  38 |   lastSync: number;
  39 | }
  40 |
  41 | // Generate a short, readable title from the first user message (like ChatGPT/Claude)
  42 | function generateTitle(message: string): string {
  43 |   if (!message || !message.trim())
  44 |     return t("sessions.newConversation", getAppLocale());
  45 |
  46 |   // Clean up the message
  47 |   let text = message.trim();
  48 |
  49 |   // Remove markdown formatting
  50 |   text = text.replace(/[#*_`~[\]()]/g, "");
  51 |   // Remove URLs
  52 |   text = text.replace(/https?:\/\/\S+/g, "");
  53 |   // Remove extra whitespace
  54 |   text = text.replace(/\s+/g, " ").trim();
  55 |
  56 |   if (!text) return t("sessions.newConversation", getAppLocale());
  57 |
  58 |   // If short enough, use as-is
  59 |   if (text.length <= 50) return text;
  60 |
  61 |   // Take first meaningful chunk — aim for ~40-50 chars at word boundary
  62 |   const words = text.split(" ");
  63 |   let title = "";
  64 |   for (const word of words) {
  65 |     if ((title + " " + word).trim().length > 45) break;
  66 |     title = (title + " " + word).trim();
  67 |   }
  68 |
  69 |   return title || text.slice(0, 45) + "...";
  70 | }
  71 |
  72 | function readCache(): CacheData {
  73 |   const file = cacheFilePath();
  74 |   try {
  75 |     if (!existsSync(file)) return { sessions: [], lastSync: 0 };
  76 |     return JSON.parse(readFileSync(file, "utf-8"));
  77 |   } catch {
  78 |     return { sessions: [], lastSync: 0 };
  79 |   }
  80 | }
  81 |
  82 | function writeCache(data: CacheData): void {
  83 |   try {
  84 |     safeWriteFile(cacheFilePath(), JSON.stringify(data));
  85 |   } catch {
  86 |     // non-fatal
  87 |   }
  88 | }
  89 |
  90 | function getDb(): Database.Database | null {
```

## Saved Model Model

`SavedModel` is the canonical desktop-side model record. Local file entries carry `source: "local-file"`, `modelPath`, `modelFormat`, and `launchable`.

```ts
   1 | import { existsSync, readFileSync } from "fs";
   2 | import { join } from "path";
   3 | import { randomUUID } from "crypto";
   4 | import { HERMES_HOME } from "./installer";
   5 | import { safeWriteFile, profilePaths } from "./utils";
   6 | import DEFAULT_MODELS from "./default-models";
   7 | import {
   8 |   buildLocalModelEntries,
   9 |   discoverLocalModelFiles,
  10 | } from "./local-model-files";
  11 |
  12 | const MODELS_FILE = join(HERMES_HOME, "models.json");
  13 |
  14 | export interface SavedModel {
  15 |   id: string;
  16 |   name: string;
  17 |   provider: string;
  18 |   model: string;
  19 |   baseUrl: string;
  20 |   apiMode?: string | null;
  21 |   source?: "default" | "custom-provider" | "local-file";
  22 |   modelPath?: string;
  23 |   modelFormat?: "gguf" | "safetensors";
  24 |   launchable?: boolean;
  25 |   createdAt: number;
  26 | }
  27 |
  28 | export function readModels(): SavedModel[] {
  29 |   try {
  30 |     if (!existsSync(MODELS_FILE)) return [];
  31 |     return JSON.parse(readFileSync(MODELS_FILE, "utf-8"));
  32 |   } catch {
  33 |     return [];
  34 |   }
  35 | }
  36 |
  37 | function writeModels(models: SavedModel[]): void {
  38 |   safeWriteFile(MODELS_FILE, JSON.stringify(models, null, 2));
  39 | }
  40 |
  41 | interface CustomProviderEntry {
  42 |   name: string;
  43 |   provider: string;
  44 |   model: string;
  45 |   baseUrl: string;
```

## JSON Schemas to Recreate

### `models.json`

```json
[
  {
    "id": "local-file-<sha1-16>",
    "name": "Local Qwen 7B",
    "provider": "custom",
    "model": "/Users/Antman/Desktop/AI_Models/Qwen-7B.gguf",
    "baseUrl": "http://localhost:8080/v1",
    "source": "local-file",
    "modelPath": "/Users/Antman/Desktop/AI_Models/Qwen-7B.gguf",
    "modelFormat": "gguf",
    "launchable": true,
    "createdAt": 1760000000000
  }
]
```

### `desktop/sessions.json`

```json
{
  "sessions": [
    {
      "id": "session-id",
      "title": "First user message summary",
      "startedAt": 1760000000,
      "source": "desktop",
      "messageCount": 12,
      "model": "openrouter/auto"
    }
  ],
  "lastSync": 1760000000
}
```

## Areas for Review

- Should SQLite access be wrapped in repository classes to make table dependencies explicit?
- Should JSON files use Zod or JSON Schema validation before writes?
- Should session cache writes include pretty JSON for debuggability or compact JSON for speed?
