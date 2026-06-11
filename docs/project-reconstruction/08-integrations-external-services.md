# 08 - Integration Points and External Services

Generated from repository state on 2026-06-11. No secrets are included; environment-variable names are documented without values.

## Hermes Agent

Hermes Agent is the primary backend. The desktop installs it into `HERMES_HOME`, starts/stops its API gateway, runs CLI commands, reads `state.db`, and edits `.env` / `config.yaml` / `SOUL.md`.

## Model Providers

The UI and main process know these provider families:

- OpenRouter, Anthropic, OpenAI, Google Gemini, xAI, Nous Portal, Qwen, MiniMax, Hugging Face.
- OpenAI-compatible hosted APIs: Groq, DeepSeek, Together, Fireworks, Cerebras, Mistral, Perplexity.
- Local/custom endpoints: LM Studio, Atomic Chat, Ollama, vLLM, llama.cpp, Docker Model Runner, any custom OpenAI-compatible URL.
- Local model files: GGUF and safetensors in the configured desktop folders.

Provider constants and env-key mappings live in `src/renderer/src/constants.ts` and are mirrored in main installer/chat logic.

## Messaging Gateways

Supported platform settings include Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, Email, SMS/Twilio/Vonage, iMessage/BlueBubbles, DingTalk, Feishu/Lark, WeCom, WeChat/iLink Bot, Webhooks, and Home Assistant.

## Memory Providers

Built-in memory editing is file/config based. External memory providers include Honcho, Hindsight, Mem0, RetainDB, Supermemory, OpenViking, ByteRover, and OpenChronicle. Provider discovery and configuration are exposed through `discover-memory-providers` and `configure-memory-provider`.

## Paperclip

Paperclip is managed as a sidecar at `http://127.0.0.1:3100` by default.

```ts
   1 | import { ChildProcess, execFile, spawn } from "child_process";
   2 | import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
   3 | import http from "http";
   4 | import https from "https";
   5 | import { join } from "path";
   6 | import { HERMES_HOME, getEnhancedPath } from "./installer";
   7 |
   8 | export const DEFAULT_PAPERCLIP_URL = "http://127.0.0.1:3100";
   9 |
  10 | export interface PaperclipConfig {
  11 |   serverUrl: string;
  12 |   telemetryDisabled: boolean;
  13 | }
  14 |
  15 | export interface PaperclipStatus {
  16 |   serverUrl: string;
  17 |   running: boolean;
  18 |   managed: boolean;
  19 |   launcherAvailable: boolean;
  20 |   launcherDetail: string | null;
  21 |   health: "ok" | "unreachable";
  22 | }
  23 |
  24 | let paperclipProcess: ChildProcess | null = null;
  25 |
  26 | function desktopConfigFile(): string {
  27 |   return join(HERMES_HOME, "desktop.json");
  28 | }
  29 |
  30 | function readDesktopConfig(): Record<string, unknown> {
  31 |   try {
  32 |     const file = desktopConfigFile();
  33 |     if (!existsSync(file)) return {};
  34 |     return JSON.parse(readFileSync(file, "utf-8"));
  35 |   } catch {
  36 |     return {};
  37 |   }
  38 | }
  39 |
  40 | function writeDesktopConfig(data: Record<string, unknown>): void {
  41 |   if (!existsSync(HERMES_HOME)) {
  42 |     mkdirSync(HERMES_HOME, { recursive: true });
  43 |   }
  44 |   writeFileSync(desktopConfigFile(), JSON.stringify(data, null, 2), "utf-8");
  45 | }
```

## Hermes Office / Claw3d

`src/main/claw3d.ts` manages a dev server, adapter process, port file, websocket URL file, gateway token propagation, and log/status APIs. The UI screen starts/stops all parts as an integrated Office workflow.

## SSH Remote Mode

SSH mode combines SSH command execution with a local tunnel. It lets the UI use the same renderer APIs while main proxies reads/writes and API calls to a remote Hermes install.

## Analytics

PostHog is optional and renderer-only. `.env.example` documents `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST`; analytics are inert without a key.

## Areas for Review

- Can provider metadata be consolidated into one shared registry consumed by renderer and main?
- Should integration health checks share one timeout/retry policy?
- Should external services be grouped into capability packs so unavailable services do not clutter first-run setup?
