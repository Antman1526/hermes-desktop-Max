# 13 - Performance Optimization and Caching

Generated from repository state on 2026-06-04. No secrets are included; environment-variable names are documented without values.

## Existing Optimizations

- Session summary cache avoids reading SQLite on every navigation.
- Session cache sync uses Map-based merges and chunked stale count refresh.
- Config reads use a five-second in-memory cache.
- SSH/session/profile file reads avoid work when files are absent.
- SSE streaming renders incrementally rather than waiting for full completion.
- Package config excludes docs/tests/scripts from app artifacts.

## Config Cache

```ts
  90 |     hasApiKey: config.apiKey.length > 0,
  91 |     apiKeyLength: config.apiKey.length,
  92 |     ssh: config.ssh,
  93 |   };
  94 | }
  95 |
  96 | export function setConnectionConfig(config: ConnectionConfig): void {
  97 |   const data = readDesktopConfig();
  98 |   data.connectionMode = config.mode;
  99 |   data.remoteUrl = config.remoteUrl;
 100 |   data.remoteApiKey = config.apiKey;
 101 |   if (config.mode === "ssh") {
 102 |     data.sshConfig = config.ssh;
 103 |   }
 104 |   writeDesktopConfig(data);
 105 | }
 106 |
 107 | export function resolveConnectionApiKeyUpdate(
 108 |   existing: ConnectionConfig,
 109 |   mode: "local" | "remote" | "ssh",
 110 |   remoteUrl: string,
 111 |   apiKey?: string,
 112 | ): string {
 113 |   if (apiKey !== undefined) return apiKey;
```

## Session Cache Optimization

```ts
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
```

## Local Model Discovery Performance

Discovery is synchronous and recursive. This is simple and deterministic, but can block if model roots are large or on a slow external disk.

```ts
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
```

## Renderer Performance

The UI uses local state and memoization sparingly. Large transcripts rely on component decomposition rather than virtualization. Session lists use cached summaries. Markdown rendering and syntax highlighting are potentially expensive for long conversations.

## Packaging Performance

`electron-builder.yml` explicitly includes only `out/**`, `resources/**`, and `package.json`, then excludes source/tests/docs/scripts/logs/maps/cache. This reduces packaged artifact size and avoids traversing the full workspace.

## Areas for Review

- Add async/cancellable local model scanning and cache results with file mtimes. Current scanning is deterministic and skips tiny files, but it still performs synchronous recursive directory traversal and `statSync` calls on any mounted model roots.
- Virtualize long chat transcripts and session lists.
- Debounce repeated settings writes from form-heavy screens.
- Split large IPC registration so startup does not import every subsystem eagerly.
- Consider lazy loading heavy screens such as Kanban, Office, Paperclip, and Settings.
