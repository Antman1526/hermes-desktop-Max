# 06 - Authentication and Authorization System

Generated from repository state on 2026-06-12. No secrets are included; environment-variable names are documented without values.

## Trust Boundaries

Authentication is split across three boundaries:

1. **Desktop to Hermes API server** - local mode may use a generated `API_SERVER_KEY`; remote mode stores an API key in `desktop.json`; SSH mode caches the remote API key after tunnel setup.
2. **Hermes Agent to model/tools providers** - provider API keys live in profile `.env` files and are passed to subprocesses or HTTP calls.
3. **OAuth/device-code providers** - login is mediated by the main process through Hermes CLI commands, with progress streamed to renderer.

## Public Connection Config Avoids Secret Leakage

The renderer receives `hasApiKey` and `apiKeyLength`, not the actual remote API key.

```ts
  65 |   writeFileSync(desktopConfigFile(), JSON.stringify(data, null, 2), "utf-8");
  66 | }
  67 |
  68 | export const DEFAULT_LOCAL_MODEL_ROOTS = [
  69 |   join(homedir(), "Desktop", "AI_Models"),
  70 |   "/Volumes/MainStore/Development/AI_Models",
  71 | ];
  72 |
  73 | export function sanitizeLocalModelRoots(roots: unknown): string[] {
  74 |   if (!Array.isArray(roots)) return [...DEFAULT_LOCAL_MODEL_ROOTS];
  75 |   const seen = new Set<string>();
  76 |   const result: string[] = [];
  77 |   for (const root of roots) {
  78 |     if (typeof root !== "string") continue;
  79 |     const trimmed = root.trim();
  80 |     if (!trimmed || seen.has(trimmed)) continue;
  81 |     seen.add(trimmed);
  82 |     result.push(trimmed);
  83 |   }
  84 |   return result.length > 0 ? result : [...DEFAULT_LOCAL_MODEL_ROOTS];
  85 | }
  86 |
  87 | export function getLocalModelRoots(): string[] {
  88 |   return sanitizeLocalModelRoots(readDesktopConfig().localModelRoots);
  89 | }
  90 |
```

## API Server Key Handling

Main exposes `get-api-server-key-status` and `generate-api-server-key`. The key is generated in main, stored in the active profile environment, and not returned except at generation time for user copy/display.

```ts

```

## Remote Authorization Header

```ts
  91 |
  92 | // Cached API key read from the remote .env when SSH tunnel starts
  93 | let _sshRemoteApiKey = "";
  94 |
  95 | export function setSshRemoteApiKey(key: string): void {
  96 |   _sshRemoteApiKey = key;
  97 | }
  98 |
  99 | export function getRemoteAuthHeader(): Record<string, string> {
 100 |   const conn = getConnectionConfig();
 101 |   if (conn.mode === "ssh") {
 102 |     if (_sshRemoteApiKey)
 103 |       return { Authorization: `Bearer ${_sshRemoteApiKey}` };
 104 |     return {};
 105 |   }
 106 |   if (conn.mode === "remote" && conn.apiKey) {
 107 |     return { Authorization: `Bearer ${conn.apiKey}` };
 108 |   }
 109 |   return {};
 110 | }
 111 |
 112 | function resolveRemoteApiKey(url: string, apiKey?: string): string {
 113 |   if (apiKey !== undefined) return apiKey;
 114 |
 115 |   const conn = getConnectionConfig();
 116 |   if (conn.mode !== "remote" || !conn.apiKey || !conn.remoteUrl) return "";
 117 |   if (normaliseRemoteUrl(conn.remoteUrl) !== normaliseRemoteUrl(url)) {
 118 |     return "";
 119 |   }
 120 |   return conn.apiKey;
 121 | }
 122 |
 123 | export async function ensureSshTunnelIfNeeded(): Promise<void> {
 124 |   const conn = getConnectionConfig();
 125 |   if (
 126 |     conn.mode === "ssh" &&
 127 |     (!isSshTunnelActive() || !(await isSshTunnelHealthy()))
```

## Provider Key Resolution

Provider keys are inferred from provider IDs and base URL patterns. Local/custom endpoints use `OPENAI_BASE_URL` with a resolved key or `no-key-required` for local no-auth endpoints.

```ts
 151 |  * when the user picks the built-in entry — same routing, same key,
 152 |  * no upstream-fallback leak.
 153 |  */
 154 | const OPENAI_COMPAT_PROVIDERS = new Set([
 155 |   // Generic
 156 |   "custom",
 157 |   // Local LLMs
 158 |   "lmstudio",
 159 |   "ollama",
 160 |   "vllm",
 161 |   "llamacpp",
 162 |   // Built-in remote OpenAI-compatible providers (must stay in sync
 163 |   // with the `id` field of remote-group entries in renderer
 164 |   // `LOCAL_PRESETS`).
 165 |   "groq",
 166 |   "deepseek",
 167 |   "together",
 168 |   "fireworks",
 169 |   "cerebras",
 170 |   "mistral",
 171 | ]);
 172 |
 173 | // Map base-URL patterns to the API key env var they need
 174 | const URL_KEY_MAP: Array<{ pattern: RegExp; envKey: string }> = [
 175 |   { pattern: /openrouter\.ai/i, envKey: "OPENROUTER_API_KEY" },
 176 |   { pattern: /anthropic\.com/i, envKey: "ANTHROPIC_API_KEY" },
 177 |   { pattern: /openai\.com/i, envKey: "OPENAI_API_KEY" },
 178 |   { pattern: /huggingface\.co/i, envKey: "HF_TOKEN" },
 179 |   { pattern: /api\.groq\.com/i, envKey: "GROQ_API_KEY" },
 180 |   { pattern: /api\.deepseek\.com/i, envKey: "DEEPSEEK_API_KEY" },
 181 |   { pattern: /api\.together\.xyz/i, envKey: "TOGETHER_API_KEY" },
 182 |   { pattern: /api\.fireworks\.ai/i, envKey: "FIREWORKS_API_KEY" },
 183 |   { pattern: /api\.cerebras\.ai/i, envKey: "CEREBRAS_API_KEY" },
 184 |   { pattern: /api\.mistral\.ai/i, envKey: "MISTRAL_API_KEY" },
```

## OAuth Flow

`src/main/hermes-auth.ts` starts Hermes CLI OAuth login, detects provider device-code output, streams progress chunks, and supports cancellation. Renderer never gets raw child process handles.

## Authorization Model

There is no multi-user authorization system inside the desktop app. Access control is local-machine based: whoever can run the desktop process can access local Hermes files, profiles, and configured provider keys. Remote mode relies on bearer token API keys.

## Edge Cases

- If the user switches remote URLs without passing an API key, `resolveConnectionApiKeyUpdate` clears the old key to avoid sending it to a different host.
- SSH mode requires tunnel health before chat; if tunnel is down, main restarts it.
- Provider key writes that affect a running gateway can trigger a targeted gateway restart.

## Areas for Review

- Should secrets move from JSON/env files into OS keychain storage?
- Should remote API keys be redacted from logs and error payloads with a shared sanitizer?
- Should the renderer receive one-time display tokens only through a modal lifecycle rather than direct return values?
