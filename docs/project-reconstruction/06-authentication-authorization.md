# 06 - Authentication and Authorization System

Generated from repository state on 2026-06-11. No secrets are included; environment-variable names are documented without values.

## Trust Boundaries

Authentication is split across three boundaries:

1. **Desktop to Hermes API server** - local mode may use a generated `API_SERVER_KEY`; remote mode stores an API key in `desktop.json`; SSH mode caches the remote API key after tunnel setup.
2. **Hermes Agent to model/tools providers** - provider API keys live in profile `.env` files and are passed to subprocesses or HTTP calls.
3. **OAuth/device-code providers** - login is mediated by the main process through Hermes CLI commands, with progress streamed to renderer.

## Public Connection Config Avoids Secret Leakage

The renderer receives `hasApiKey` and `apiKeyLength`, not the actual remote API key.

```ts
  65 | }
  66 |
  67 | export function getConnectionConfig(): ConnectionConfig {
  68 |   const data = readDesktopConfig();
  69 |   const ssh = (data.sshConfig as Partial<SshConnectionConfig>) ?? {};
  70 |   return {
  71 |     mode: (data.connectionMode as "local" | "remote" | "ssh") || "local",
  72 |     remoteUrl: (data.remoteUrl as string) || "",
  73 |     apiKey: (data.remoteApiKey as string) || "",
  74 |     ssh: {
  75 |       host: (ssh.host as string) || "",
  76 |       port: (ssh.port as number) || 22,
  77 |       username: (ssh.username as string) || "",
  78 |       keyPath: (ssh.keyPath as string) || "",
  79 |       remotePort: (ssh.remotePort as number) || 8642,
  80 |       localPort: (ssh.localPort as number) || 18642,
  81 |     },
  82 |   };
  83 | }
  84 |
  85 | export function getPublicConnectionConfig(): PublicConnectionConfig {
  86 |   const config = getConnectionConfig();
  87 |   return {
  88 |     mode: config.mode,
  89 |     remoteUrl: config.remoteUrl,
  90 |     hasApiKey: config.apiKey.length > 0,
```

## API Server Key Handling

Main exposes `get-api-server-key-status` and `generate-api-server-key`. The key is generated in main, stored in the active profile environment, and not returned except at generation time for user copy/display.

```ts
 647 |   ipcMain.handle("get-api-server-key-status", (_event, profile?: string) => {
 648 |     const key = getApiServerKey(profile);
 649 |     return { hasKey: key.length > 0 };
 650 |   });
 651 |
 652 |   ipcMain.handle(
 653 |     "generate-api-server-key",
 654 |     async (_event, profile?: string) => {
 655 |       const { randomUUID } = await import("crypto");
 656 |       const key = `desk-${randomUUID()}`;
 657 |       // Write to both the active profile .env and the default .env so the
 658 |       // gateway (which reads the profile .env) and the desktop (which reads
 659 |       // the default .env as fallback) both see the same key.
 660 |       setEnvValue("API_SERVER_KEY", key, profile);
 661 |       if (profile && profile !== "default") {
 662 |         setEnvValue("API_SERVER_KEY", key);
 663 |       }
 664 |       // Restart gateway so it picks up the new key immediately.
 665 |       if (isGatewayRunning()) {
 666 |         stopGateway();
 667 |         await new Promise<void>((r) => setTimeout(r, 800));
 668 |         startGateway(profile);
 669 |       }
 670 |       return { key };
 671 |     },
 672 |   );
 673 |
 674 |   // Connection mode (local / remote / ssh)
```

## Remote Authorization Header

```ts
  91 |
  92 | export function setSshRemoteApiKey(key: string): void {
  93 |   _sshRemoteApiKey = key;
  94 | }
  95 |
  96 | export function getRemoteAuthHeader(): Record<string, string> {
  97 |   const conn = getConnectionConfig();
  98 |   if (conn.mode === "ssh") {
  99 |     if (_sshRemoteApiKey)
 100 |       return { Authorization: `Bearer ${_sshRemoteApiKey}` };
 101 |     return {};
 102 |   }
 103 |   if (conn.mode === "remote" && conn.apiKey) {
 104 |     return { Authorization: `Bearer ${conn.apiKey}` };
 105 |   }
 106 |   return {};
 107 | }
 108 |
 109 | function resolveRemoteApiKey(url: string, apiKey?: string): string {
 110 |   if (apiKey !== undefined) return apiKey;
 111 |
 112 |   const conn = getConnectionConfig();
 113 |   if (conn.mode !== "remote" || !conn.apiKey || !conn.remoteUrl) return "";
 114 |   if (normaliseRemoteUrl(conn.remoteUrl) !== normaliseRemoteUrl(url)) {
 115 |     return "";
 116 |   }
 117 |   return conn.apiKey;
 118 | }
 119 |
 120 | export async function ensureSshTunnelIfNeeded(): Promise<void> {
 121 |   const conn = getConnectionConfig();
 122 |   if (
 123 |     conn.mode === "ssh" &&
 124 |     (!isSshTunnelActive() || !(await isSshTunnelHealthy()))
 125 |   ) {
 126 |     await startSshTunnel(conn.ssh);
 127 |   }
```

## Provider Key Resolution

Provider keys are inferred from provider IDs and base URL patterns. Local/custom endpoints use `OPENAI_BASE_URL` with a resolved key or `no-key-required` for local no-auth endpoints.

```ts
 151 | const OPENAI_COMPAT_PROVIDERS = new Set([
 152 |   // Generic
 153 |   "custom",
 154 |   // Local LLMs
 155 |   "lmstudio",
 156 |   "ollama",
 157 |   "vllm",
 158 |   "llamacpp",
 159 |   // Built-in remote OpenAI-compatible providers (must stay in sync
 160 |   // with the `id` field of remote-group entries in renderer
 161 |   // `LOCAL_PRESETS`).
 162 |   "groq",
 163 |   "deepseek",
 164 |   "together",
 165 |   "fireworks",
 166 |   "cerebras",
 167 |   "mistral",
 168 | ]);
 169 |
 170 | // Map base-URL patterns to the API key env var they need
 171 | const URL_KEY_MAP: Array<{ pattern: RegExp; envKey: string }> = [
 172 |   { pattern: /openrouter\.ai/i, envKey: "OPENROUTER_API_KEY" },
 173 |   { pattern: /anthropic\.com/i, envKey: "ANTHROPIC_API_KEY" },
 174 |   { pattern: /openai\.com/i, envKey: "OPENAI_API_KEY" },
 175 |   { pattern: /huggingface\.co/i, envKey: "HF_TOKEN" },
 176 |   { pattern: /api\.groq\.com/i, envKey: "GROQ_API_KEY" },
 177 |   { pattern: /api\.deepseek\.com/i, envKey: "DEEPSEEK_API_KEY" },
 178 |   { pattern: /api\.together\.xyz/i, envKey: "TOGETHER_API_KEY" },
 179 |   { pattern: /api\.fireworks\.ai/i, envKey: "FIREWORKS_API_KEY" },
 180 |   { pattern: /api\.cerebras\.ai/i, envKey: "CEREBRAS_API_KEY" },
 181 |   { pattern: /api\.mistral\.ai/i, envKey: "MISTRAL_API_KEY" },
 182 |   { pattern: /api\.perplexity\.ai/i, envKey: "PERPLEXITY_API_KEY" },
 183 | ];
 184 |
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
