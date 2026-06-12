# 08 - Integration Points and External Services

Generated from repository state on 2026-06-12. No secrets are included; environment-variable names are documented without values.

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
   2 | import {
   3 |   appendFileSync,
   4 |   existsSync,
   5 |   mkdirSync,
   6 |   readFileSync,
   7 |   writeFileSync,
   8 | } from "fs";
   9 | import http from "http";
  10 | import https from "https";
  11 | import { join } from "path";
  12 | import { HERMES_HOME, getEnhancedPath } from "./installer";
  13 |
  14 | export const DEFAULT_PAPERCLIP_URL = "http://127.0.0.1:3100";
  15 | export const DEFAULT_PAPERCLIP_VERSION = "2026.529.0";
  16 | export const PAPERCLIP_NPX_ARGS = [
  17 |   "--yes",
  18 |   `paperclipai@${DEFAULT_PAPERCLIP_VERSION}`,
  19 |   "run",
  20 | ];
  21 | export const PAPERCLIP_STARTUP_TIMEOUT_MS = 180000;
  22 | const PAPERCLIP_HEALTH_POLL_MS = 750;
  23 | const PAPERCLIP_NPX_CANDIDATES =
  24 |   process.platform === "win32"
  25 |     ? ["npx.cmd", "npx"]
  26 |     : ["/opt/homebrew/bin/npx", "/usr/local/bin/npx", "/usr/bin/npx", "npx"];
  27 |
  28 | export interface PaperclipConfig {
  29 |   serverUrl: string;
  30 |   autoStart: boolean;
  31 |   telemetryDisabled: boolean;
  32 | }
  33 |
  34 | export interface PaperclipStatus {
  35 |   serverUrl: string;
  36 |   running: boolean;
  37 |   managed: boolean;
  38 |   launcherAvailable: boolean;
  39 |   launcherDetail: string | null;
  40 |   health: "ok" | "unreachable";
  41 | }
  42 |
  43 | let paperclipProcess: ChildProcess | null = null;
  44 |
  45 | function desktopConfigFile(): string {
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
