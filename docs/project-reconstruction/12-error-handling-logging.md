# 12 - Error Handling and Logging

Generated from repository state on 2026-06-12. No secrets are included; environment-variable names are documented without values.

## Error Handling Patterns

The project uses pragmatic error handling:

- Main IPC handlers often catch exceptions and return `false`, `null`, empty arrays, or `{ success: false, error }`.
- File readers treat missing/corrupt local state as empty/default state.
- Child process managers attach `error`/`close` listeners and clear process references.
- Health checks use short timeouts and return booleans.
- User-facing errors are surfaced through renderer state or progress streams.

## Global Main Guard

```ts

```

## Config Read Defaults

`readDesktopConfig` intentionally swallows parse/read errors and returns an empty object so startup survives bad config.

```ts
  47 | function desktopConfigFile(): string {
  48 |   return join(HERMES_HOME, "desktop.json");
  49 | }
  50 |
  51 | export function readDesktopConfig(): Record<string, unknown> {
  52 |   try {
  53 |     const f = desktopConfigFile();
  54 |     if (!existsSync(f)) return {};
  55 |     return JSON.parse(readFileSync(f, "utf-8"));
  56 |   } catch {
  57 |     return {};
  58 |   }
  59 | }
  60 |
  61 | export function writeDesktopConfig(data: Record<string, unknown>): void {
  62 |   if (!existsSync(HERMES_HOME)) {
  63 |     mkdirSync(HERMES_HOME, { recursive: true });
  64 |   }
```

## Paperclip Error Pattern

```ts
 168 |             res.statusCode >= 300
 169 |           ) {
 170 |             resolve(false);
 171 |             return;
 172 |           }
 173 |           try {
 174 |             const parsed = JSON.parse(body) as { status?: unknown };
 175 |             resolve(parsed.status === "ok");
 176 |           } catch {
 177 |             resolve(false);
 178 |           }
 179 |         });
 180 |       },
 181 |     );
 182 |     req.on("error", () => resolve(false));
 183 |     req.on("timeout", () => {
 184 |       req.destroy();
 185 |       resolve(false);
 186 |     });
 187 |     req.end();
 188 |   });
 189 | }
 190 |
 191 | function execFileOutput(
 192 |   command: string,
 193 |   args: string[],
 194 |   timeout = 5000,
 195 | ): Promise<{ ok: boolean; output: string; error: string | null }> {
 196 |   return new Promise((resolve) => {
 197 |     execFile(
 198 |       command,
 199 |       args,
 200 |       {
 201 |         env: { ...process.env, PATH: getEnhancedPath() },
 202 |         timeout,
 203 |       },
 204 |       (error, stdout, stderr) => {
 205 |         resolve({
 206 |           ok: !error,
 207 |           output: (stdout || stderr || "").toString().trim(),
 208 |           error: error ? error.message : null,
 209 |         });
 210 |       },
 211 |     );
 212 |   });
 213 | }
 214 |
 215 | export function resolvePaperclipNpxCommand(
 216 |   fileExists: (path: string) => boolean = existsSync,
 217 | ): string {
 218 |   for (const candidate of PAPERCLIP_NPX_CANDIDATES) {
```

## Logging

Log sources:

- Electron main console output.
- Hermes Agent logs under `HERMES_HOME/logs`.
- Gateway log files read by `read-logs`.
- Installer progress emitted over `install-progress`.
- OAuth progress emitted over `oauth-login-progress`.
- Claw3d logs through `claw3d-get-logs`.
- Updater logs through `updater-log.ts`.

## Debugging Procedure

1. Run `npm run dev:fresh` for a clean `HERMES_HOME`.
2. Use Settings log viewer for gateway/agent logs.
3. Run `runHermesDoctor` from Settings or `window.hermesAPI.runHermesDoctor()`.
4. Check `desktop.json`, `.env`, `config.yaml`, and `models.json`.
5. For local model issues, check `local-model-server.pid`, `local-model-server-model`, `local-model-server-port`, `llama-server` availability, and `http://127.0.0.1:<port>/v1/models`.

## Areas for Review

- Should all IPC handlers use structured error codes and renderer-localized messages?
- Should logs be redacted centrally for API keys and tokens?
- Should child process logs be persisted per subsystem rather than swallowed with `stdio: "ignore"`?
