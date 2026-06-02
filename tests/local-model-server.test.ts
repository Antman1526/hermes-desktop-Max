import { describe, expect, it } from "vitest";
import {
  buildLlamaServerArgs,
  isDiscoveredLocalModelPath,
  isLaunchableLocalModel,
  resolveLlamaServerCommand,
} from "../src/main/local-model-server";

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
});
