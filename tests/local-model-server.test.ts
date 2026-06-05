import { describe, expect, it } from "vitest";
import http from "http";
import type { AddressInfo } from "net";
import {
  buildLlamaServerArgs,
  findAvailableLocalModelPort,
  getLocalModelRuntimeStatus,
  isLocalModelServerHealthy,
  isDiscoveredLocalModelPath,
  isLaunchableLocalModel,
  LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT,
  resolveLlamaServerCommand,
  waitForLocalModelServerReady,
} from "../src/main/local-model-server";

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe("local model server launcher helpers", () => {
  it("only auto-launches GGUF local file models", () => {
    expect(isLaunchableLocalModel("/models/Qwen3.gguf")).toBe(true);
    expect(isLaunchableLocalModel("/models/Qwen3.GGUF")).toBe(true);
    expect(isLaunchableLocalModel("/models/Qwen3.safetensors")).toBe(false);
    expect(isLaunchableLocalModel("anthropic/claude-sonnet-4")).toBe(false);
  });

  it("builds llama-server arguments for an OpenAI-compatible localhost server", () => {
    expect(buildLlamaServerArgs("/models/Hermes-3.gguf", 8080)).toEqual([
      "--model",
      "/models/Hermes-3.gguf",
      "--host",
      "127.0.0.1",
      "--port",
      "8080",
      "--alias",
      "/models/Hermes-3.gguf",
    ]);
  });

  it("prefers an existing Homebrew llama-server before falling back to PATH", () => {
    expect(
      resolveLlamaServerCommand(
        (candidate) => candidate === "/opt/homebrew/bin/llama-server",
      ),
    ).toBe("/opt/homebrew/bin/llama-server");
  });

  it("provides an actionable install hint when llama-server is missing", () => {
    expect(LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT).toContain(
      "brew install llama.cpp",
    );
    expect(LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT).toContain("llama-server");
  });

  it("reports local model runtime status for a missing llama-server", () => {
    expect(
      getLocalModelRuntimeStatus(
        () => false,
        () => false,
      ),
    ).toEqual({
      llamaServerAvailable: false,
      llamaServerPath: null,
      installHint: LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT,
    });
  });

  it("only allows discovered GGUF model paths to launch", () => {
    const files = [
      { path: "/models/Hermes-3.gguf", format: "gguf" as const },
      { path: "/models/Qwen3.safetensors", format: "safetensors" as const },
    ];

    expect(isDiscoveredLocalModelPath("/models/Hermes-3.gguf", files)).toBe(
      true,
    );
    expect(isDiscoveredLocalModelPath("/models/Qwen3.safetensors", files)).toBe(
      false,
    );
    expect(isDiscoveredLocalModelPath("/other/Unknown.gguf", files)).toBe(
      false,
    );
  });

  it("waits for the local OpenAI endpoint to become ready before reporting startup success", async () => {
    let attempts = 0;

    const ready = await waitForLocalModelServerReady({
      timeoutMs: 100,
      intervalMs: 1,
      healthCheck: async () => {
        attempts++;
        return attempts === 3;
      },
    });

    expect(ready).toBe(true);
    expect(attempts).toBe(3);
  });

  it("times out when the local OpenAI endpoint never becomes ready", async () => {
    let attempts = 0;

    const ready = await waitForLocalModelServerReady({
      timeoutMs: 5,
      intervalMs: 1,
      healthCheck: async () => {
        attempts++;
        return false;
      },
    });

    expect(ready).toBe(false);
    expect(attempts).toBeGreaterThanOrEqual(1);
  });

  it("picks the first available local model port when the default is occupied", async () => {
    const selected = await findAvailableLocalModelPort({
      startPort: 8080,
      endPort: 8083,
      isPortAvailable: async (port) => port === 8082,
    });

    expect(selected).toBe(8082);
  });

  it("does not treat an arbitrary 404 service as a healthy local model server", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: "undefined_endpoint" }));
    });
    const port = await listen(server);

    try {
      await expect(isLocalModelServerHealthy(port)).resolves.toBe(false);
    } finally {
      await close(server);
    }
  });

  it("accepts an OpenAI-compatible /v1/models response as healthy", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/v1/models") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "local-model" }] }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    const port = await listen(server);

    try {
      await expect(isLocalModelServerHealthy(port)).resolves.toBe(true);
    } finally {
      await close(server);
    }
  });
});
