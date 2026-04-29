# MainStore Local Models Design

## Goal

Configure Hermes Desktop so the existing Ollama-backed local model remains the default, while MainStore Docker Model Runner models are available in the saved model library for manual selection when needed.

## Current State

Hermes runtime config at `~/.hermes/config.yaml` currently uses:

- provider: `custom`
- default model: `hf.co/khazarai/Qwen3-4B-Qwen3.6-plus-Reasoning-Distilled-GGUF:Q8_0`
- base URL: `http://localhost:11434/v1`

MainStore has Docker Model Runner model metadata at `/Volumes/MainStore/DockerDMR/models/models.json` with these tags:

- `docker.io/ai/qwen3.6:latest`
- `docker.io/ai/deepseek-v4-flash-safetensors:latest`

Hermes Desktop does not currently have `~/.hermes/models.json`, so saved model entries have not been initialized on this machine.

## Approach

Use a minimal config-only update:

- Keep `~/.hermes/config.yaml` unchanged so Ollama remains the default local endpoint.
- Create or update `~/.hermes/models.json` with saved model entries for the current Ollama default and both MainStore Docker Model Runner models.
- Use provider `custom` for all entries because Hermes Desktop already treats OpenAI-compatible local providers as API-key-free.
- Point Docker Model Runner entries at Docker's OpenAI-compatible endpoint `http://localhost:12434/engines/v1`.

## Verification

After applying the config:

- Confirm `~/.hermes/config.yaml` still points at `http://localhost:11434/v1`.
- Confirm `~/.hermes/models.json` contains the Ollama default plus the two MainStore Docker model tags.
- If Docker Model Runner is running, optionally query its `/models` endpoint to confirm the tags are available.

## Out Of Scope

- No app source changes.
- No automatic filesystem scanning of MainStore.
- No default model switch away from the current Ollama configuration.
