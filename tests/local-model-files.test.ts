import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildLocalModelEntries,
  discoverLocalModelFiles,
  getLocalModelScanStatus,
  mergeDiscoveredLocalModelEntries,
  rescanLocalModels,
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
    writeFileSync(gguf, Buffer.alloc(1_100_000));
    writeFileSync(
      join(mainStore, "GGUF", "._Hermes-3-Llama-3.1-8B-Q4_K_M.gguf"),
      "",
    );
    writeFileSync(join(mainStore, "STT.bin"), Buffer.alloc(1_100_000));
    writeFileSync(safetensors, Buffer.alloc(1_100_000));

    expect(discoverLocalModelFiles([mainStore, desktop])).toEqual([
      expect.objectContaining({ path: gguf, root: mainStore, format: "gguf" }),
      expect.objectContaining({
        path: safetensors,
        root: desktop,
        format: "safetensors",
      }),
    ]);
  });

  it("skips tiny model files that are usually incomplete downloads or LFS pointers", () => {
    const root = join(TEST_DIR, "AI_Models");
    mkdirSync(join(root, "GGUF"), { recursive: true });

    writeFileSync(join(root, "GGUF", "broken.gguf"), "version https://git-lfs");

    expect(discoverLocalModelFiles([root])).toEqual([]);
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
        available: true,
        rootAvailable: true,
        modelRoot: root,
      }),
    ]);
  });

  it("marks missing local-file entries unavailable without removing them", () => {
    const mainStore = join(TEST_DIR, "MainStore", "AI_Models");
    const desktop = join(TEST_DIR, "Desktop", "AI_Models");
    const presentPath = join(desktop, "GGUF", "Llama-3.2-3B.gguf");
    const unmountedPath = join(mainStore, "GGUF", "Hermes-3.gguf");
    mkdirSync(join(desktop, "GGUF"), { recursive: true });
    writeFileSync(presentPath, Buffer.alloc(1_100_000));

    const existing = [
      {
        id: "cloud",
        name: "Cloud",
        provider: "openrouter",
        model: "anthropic/claude",
        baseUrl: "",
        createdAt: 1,
      },
      {
        id: "local-file-old",
        name: "Local Hermes",
        provider: "custom",
        model: unmountedPath,
        baseUrl: "http://localhost:8080/v1",
        source: "local-file" as const,
        modelPath: unmountedPath,
        modelFormat: "gguf" as const,
        modelRoot: mainStore,
        launchable: true,
        available: true,
        rootAvailable: true,
        createdAt: 2,
      },
    ];

    const next = mergeDiscoveredLocalModelEntries(existing, {
      discovered: buildLocalModelEntries(
        discoverLocalModelFiles([mainStore, desktop]),
      ),
      roots: [mainStore, desktop],
    });

    expect(next).toEqual([
      existing[0],
      expect.objectContaining({
        id: "local-file-old",
        available: false,
        rootAvailable: false,
        unavailableReason: `Model folder is not mounted: ${mainStore}`,
      }),
      expect.objectContaining({
        model: presentPath,
        available: true,
        rootAvailable: true,
      }),
    ]);
  });

  it("reports scan status for mounted and missing configured roots", () => {
    const mountedRoot = join(TEST_DIR, "Desktop", "AI_Models");
    const missingRoot = join(TEST_DIR, "MainStore", "AI_Models");
    const modelPath = join(mountedRoot, "GGUF", "Llama-3.2-3B.gguf");
    mkdirSync(join(mountedRoot, "GGUF"), { recursive: true });
    writeFileSync(modelPath, Buffer.alloc(1_100_000));

    const status = getLocalModelScanStatus([mountedRoot, missingRoot]);

    expect(status.roots).toEqual([
      expect.objectContaining({
        path: mountedRoot,
        available: true,
        modelCount: 1,
      }),
      expect.objectContaining({
        path: missingRoot,
        available: false,
        modelCount: 0,
      }),
    ]);
    expect(status.files).toEqual([
      expect.objectContaining({
        path: modelPath,
        root: mountedRoot,
        format: "gguf",
      }),
    ]);
  });

  it("rescans local models and returns built entries with scan status", () => {
    const root = join(TEST_DIR, "Desktop", "AI_Models");
    const modelPath = join(root, "GGUF", "Hermes-3.gguf");
    mkdirSync(join(root, "GGUF"), { recursive: true });
    writeFileSync(modelPath, Buffer.alloc(1_100_000));

    const result = rescanLocalModels([root]);

    expect(result.status.roots).toEqual([
      expect.objectContaining({ path: root, available: true, modelCount: 1 }),
    ]);
    expect(result.models).toEqual([
      expect.objectContaining({
        model: modelPath,
        source: "local-file",
        available: true,
      }),
    ]);
  });
});
