# 12 - Error Handling and Logging

Generated from repository state on 2026-06-04. No secrets are included; environment-variable names are documented without values.

## Error Handling Patterns

The project uses pragmatic error handling:

- Main IPC handlers often catch exceptions and return `false`, `null`, empty arrays, or `{ success: false, error }`.
- File readers treat missing/corrupt local state as empty/default state.
- Child process managers attach `error`/`close` listeners and clear process references.
- Health checks use short timeouts and return booleans.
- User-facing errors are surfaced through renderer state or progress streams.

## Global Main Guard

```ts
 190 |   sshListInstalledSkills,
 191 |   sshGetSkillContent,
 192 |   sshInstallSkill,
 193 |   sshUninstallSkill,
 194 |   sshListBundledSkills,
 195 |   sshReadMemory,
 196 |   sshAddMemoryEntry,
 197 |   sshUpdateMemoryEntry,
 198 |   sshRemoveMemoryEntry,
 199 |   sshWriteUserProfile,
 200 |   sshReadSoul,
 201 |   sshWriteSoul,
 202 |   sshResetSoul,
 203 |   sshGetToolsets,
 204 |   sshSetToolsetEnabled,
 205 |   sshReadEnv,
 206 |   sshSetEnvValue,
 207 |   sshGetConfigValue,
 208 |   sshSetConfigValue,
 209 |   sshGetHermesHome,
 210 |   sshGetModelConfig,
```

## Config Read Defaults

`readDesktopConfig` intentionally swallows parse/read errors and returns an empty object so startup survives bad config.

```ts
  47 |   return join(HERMES_HOME, "desktop.json");
  48 | }
  49 |
  50 | export function readDesktopConfig(): Record<string, unknown> {
  51 |   try {
  52 |     const f = desktopConfigFile();
  53 |     if (!existsSync(f)) return {};
  54 |     return JSON.parse(readFileSync(f, "utf-8"));
  55 |   } catch {
  56 |     return {};
  57 |   }
  58 | }
  59 |
  60 | export function writeDesktopConfig(data: Record<string, unknown>): void {
  61 |   if (!existsSync(HERMES_HOME)) {
  62 |     mkdirSync(HERMES_HOME, { recursive: true });
  63 |   }
  64 |   writeFileSync(desktopConfigFile(), JSON.stringify(data, null, 2), "utf-8");
```

## Paperclip Error Pattern

```ts
 168 |   return { available: false, detail: null };
 169 | }
 170 |
 171 | export async function getPaperclipStatus(): Promise<PaperclipStatus> {
 172 |   const config = getPaperclipConfig();
 173 |   const [healthy, launcher] = await Promise.all([
 174 |     requestHealth(config.serverUrl),
 175 |     getLauncherInfo(),
 176 |   ]);
 177 |   const managed = Boolean(paperclipProcess && !paperclipProcess.killed);
 178 |
 179 |   return {
 180 |     serverUrl: config.serverUrl,
 181 |     running: healthy,
 182 |     managed,
 183 |     launcherAvailable: launcher.available,
 184 |     launcherDetail: launcher.detail,
 185 |     health: healthy ? "ok" : "unreachable",
 186 |   };
 187 | }
 188 |
 189 | export async function startPaperclip(): Promise<{
 190 |   success: boolean;
 191 |   error?: string;
 192 | }> {
 193 |   const status = await getPaperclipStatus();
 194 |   if (status.running) return { success: true };
 195 |   if (!status.launcherAvailable) {
 196 |     return {
 197 |       success: false,
 198 |       error:
 199 |         "Paperclip launcher not found. Install Node.js/npm so npx is available.",
 200 |     };
 201 |   }
 202 |
 203 |   const config = getPaperclipConfig();
 204 |   const env: NodeJS.ProcessEnv = {
 205 |     ...process.env,
 206 |     PATH: getEnhancedPath(),
 207 |   };
 208 |   if (config.telemetryDisabled) {
 209 |     env.PAPERCLIP_TELEMETRY_DISABLED = "1";
 210 |     env.DO_NOT_TRACK = "1";
 211 |   }
 212 |
 213 |   paperclipProcess = spawn("npx", ["paperclipai", "run"], {
 214 |     env,
 215 |     stdio: "ignore",
 216 |     detached: false,
 217 |   });
 218 |   paperclipProcess.unref();
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
5. For local model issues, check `local-model-server.pid`, `local-model-server-model`, `llama-server` availability, and `http://127.0.0.1:8080/v1/models`. If the app reports `llama-server was not found`, install llama.cpp with `brew install llama.cpp` or place a `llama-server` binary on PATH.

## Areas for Review

- Should all IPC handlers use structured error codes and renderer-localized messages?
- Should logs be redacted centrally for API keys and tokens?
- Should child process logs be persisted per subsystem rather than swallowed with `stdio: "ignore"`?
