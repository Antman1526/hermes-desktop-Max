# Local Model Auto-Port Design

## Goal

Make local GGUF models from `/Volumes/MainStore/Development/AI_Models` and `/Users/Antman/Desktop/AI_Models` work smoothly even when the default llama.cpp server port `8080` is already occupied.

## Design

The desktop app will keep `8080` as the preferred local model port, but before launching `llama-server` it will scan a small local range starting at `8080` and pick the first bindable port. The selected port will be written to a local state file next to the existing PID/model files so status checks and model config can use the same base URL after launch.

Health checks will become stricter. A random service returning `404` on `http://127.0.0.1:8080/v1/models` must not count as a running local model server. The health probe should require a successful OpenAI-compatible `/v1/models` response with a JSON `data` array.

When Chat selects a launchable local model, the main process starts `llama-server`, waits for the chosen port to become healthy, then returns the actual base URL. The renderer writes that returned base URL into `config.yaml` through `setModelConfig`, so Hermes Agent sends chat requests to the correct port.

## Scope

Included:

- Auto-select `8080`, `8081`, `8082`, etc. when lower ports are unavailable.
- Persist the chosen port for status and restart awareness.
- Reject non-OpenAI-compatible responses as unhealthy.
- Update Chat model selection to use the returned base URL.
- Add focused tests for port selection, health checks, and config handoff.

Excluded:

- Configurable model roots UI.
- Safetensors serving. Safetensors stay discoverable but non-launchable.
- Installing `llama-server` automatically.

## Areas for Review

- Should the port range be user-configurable later?
- Should local model status expose the blocking process when a port is occupied?
- Should the Models page add a local-model status panel after this core launch path is stable?
