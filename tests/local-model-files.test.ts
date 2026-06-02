import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildLocalModelEntries,
  discoverLocalModelFiles,
} from "../src/main/local-model-files";

const TEST_DIR = join(tmpdir(), `hermes-local-models-${Date.now()}`);

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("local model file discovery", () => {
  it("discovers GGUF and safetensors model files under configured roots", () => {
    const mainStore = join(TEST_DIR, "MainStore", "AI_Models");
    const desktop = join(TEST_DIR, "Desktop", "AI_Models");
    mkdirSync(join(mainStore, "GGUF"), { recursive: true });
    mkdirSync(join(desktop, "Transformers"), { recursive: true });

    const gguf = join(mainStore, "GGUF", "Hermes-3-Llama-3.1-8B-Q4_K_M.gguf");
    const safetensors = join(
      desktop,
      "Transformers",
      "Qwen3-Coder-30B.safetensors",
    );
    writeFileSync(gguf, "");
    writeFileSync(
      join(mainStore, "GGUF", "._Hermes-3-Llama-3.1-8B-Q4_K_M.gguf"),
      "",
    );
    writeFileSync(join(mainStore, "STT.bin"), "");
    writeFileSync(safetensors, "");

    expect(discoverLocalModelFiles([mainStore, desktop])).toEqual([
      { path: gguf, root: mainStore, format: "gguf" },
      { path: safetensors, root: desktop, format: "safetensors" },
    ]);
  });

  it("builds stable custom-provider entries that preserve local server base URL", () => {
    const root = join(TEST_DIR, "AI_Models");
    const modelPath = join(root, "GGUF", "Qwen3.6-27B-Q4_K_M.gguf");

    const entries = buildLocalModelEntries([
      { path: modelPath, root, format: "gguf" },
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^local-file-/),
        name: "Local Qwen3.6 27B Q4 K M",
        provider: "custom",
        model: modelPath,
        baseUrl: "http://localhost:8080/v1",
        source: "local-file",
        modelPath,
        modelFormat: "gguf",
        launchable: true,
      }),
    ]);
  });
});
