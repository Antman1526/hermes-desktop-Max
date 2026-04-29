# MainStore Local Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the current Ollama model as Hermes' default while adding MainStore Docker Model Runner models to the saved model library for manual selection.

**Architecture:** This is a config-only change. `~/.hermes/config.yaml` remains unchanged; `~/.hermes/models.json` is created or updated with three saved model entries using Hermes Desktop's existing `SavedModel` shape.

**Tech Stack:** Hermes Desktop local config, JSON, OpenAI-compatible local model endpoints.

---

### Task 1: Write Saved Model Library Config

**Files:**
- Modify: `/Users/Antman/.hermes/models.json`
- Read: `/Users/Antman/.hermes/config.yaml`
- Read: `/Volumes/MainStore/DockerDMR/models/models.json`

- [ ] **Step 1: Confirm the current default remains Ollama-backed**

Run:

```bash
sed -n '1,12p' /Users/Antman/.hermes/config.yaml
```

Expected output includes:

```yaml
model:
  default: hf.co/khazarai/Qwen3-4B-Qwen3.6-plus-Reasoning-Distilled-GGUF:Q8_0
  provider: custom
  base_url: http://localhost:11434/v1
```

- [ ] **Step 2: Confirm MainStore model tags**

Run:

```bash
sed -n '1,40p' /Volumes/MainStore/DockerDMR/models/models.json
```

Expected output includes:

```json
"docker.io/ai/qwen3.6:latest"
"docker.io/ai/deepseek-v4-flash-safetensors:latest"
```

- [ ] **Step 3: Back up any existing saved model library**

If `/Users/Antman/.hermes/models.json` exists, copy it to:

```text
/Users/Antman/.hermes/models.json.bak-20260429-mainstore
```

If it does not exist, skip the backup.

- [ ] **Step 4: Write `/Users/Antman/.hermes/models.json`**

Write this exact JSON:

```json
[
  {
    "id": "local-ollama-qwen3-reasoning-q8",
    "name": "Ollama Qwen3 Reasoning Q8",
    "provider": "custom",
    "model": "hf.co/khazarai/Qwen3-4B-Qwen3.6-plus-Reasoning-Distilled-GGUF:Q8_0",
    "baseUrl": "http://localhost:11434/v1",
    "createdAt": 1777420800000
  },
  {
    "id": "mainstore-dmr-qwen3-6",
    "name": "MainStore DMR Qwen 3.6",
    "provider": "custom",
    "model": "ai/qwen3.6:latest",
    "baseUrl": "http://localhost:12434/engines/v1",
    "createdAt": 1777420800000
  },
  {
    "id": "mainstore-dmr-deepseek-v4-flash",
    "name": "MainStore DMR DeepSeek V4 Flash",
    "provider": "custom",
    "model": "ai/deepseek-v4-flash-safetensors:latest",
    "baseUrl": "http://localhost:12434/engines/v1",
    "createdAt": 1777420800000
  }
]
```

- [ ] **Step 5: Validate JSON syntax**

Run:

```bash
node -e "const fs=require('fs'); const models=JSON.parse(fs.readFileSync('/Users/Antman/.hermes/models.json','utf8')); console.log(models.map(m => `${m.name} -> ${m.model} @ ${m.baseUrl}`).join('\n'))"
```

Expected output:

```text
Ollama Qwen3 Reasoning Q8 -> hf.co/khazarai/Qwen3-4B-Qwen3.6-plus-Reasoning-Distilled-GGUF:Q8_0 @ http://localhost:11434/v1
MainStore DMR Qwen 3.6 -> ai/qwen3.6:latest @ http://localhost:12434/engines/v1
MainStore DMR DeepSeek V4 Flash -> ai/deepseek-v4-flash-safetensors:latest @ http://localhost:12434/engines/v1
```

- [ ] **Step 6: Verify Hermes default was not changed**

Run:

```bash
sed -n '1,12p' /Users/Antman/.hermes/config.yaml
```

Expected output still includes:

```yaml
base_url: http://localhost:11434/v1
```

### Task 2: Optional Runtime Endpoint Check

**Files:**
- Read: Docker Model Runner HTTP endpoint

- [ ] **Step 1: Check Docker Model Runner model endpoint**

Run:

```bash
curl -s http://localhost:12434/engines/v1/models
```

Expected: JSON response listing models if Docker Model Runner is running. Connection failure is acceptable if Docker Model Runner is stopped; the saved model library config remains valid.
