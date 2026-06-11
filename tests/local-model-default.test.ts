import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let testHome = "";

async function loadModules(): Promise<{
  config: typeof import("../src/main/config");
  models: typeof import("../src/main/models");
}> {
  vi.resetModules();
  vi.stubEnv("HERMES_HOME", testHome);
  const config = await import("../src/main/config");
  const models = await import("../src/main/models");
  return { config, models };
}

describe("Desktop GGUF active default", () => {
  beforeEach(() => {
    testHome = join(tmpdir(), `hermes-local-default-${Date.now()}`);
    mkdirSync(testHome, { recursive: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    rmSync(testHome, { recursive: true, force: true });
  });

  it("selects the first available Desktop GGUF when the active profile has no model", async () => {
    const desktopRoot = join(testHome, "Desktop", "AI_Models");
    const mainStoreRoot = join(testHome, "MainStore", "AI_Models");
    const desktopModel = join(desktopRoot, "GGUF", "Phi-4-mini.gguf");
    const mainStoreModel = join(mainStoreRoot, "GGUF", "Hermes-3.gguf");
    mkdirSync(join(desktopRoot, "GGUF"), { recursive: true });
    mkdirSync(join(mainStoreRoot, "GGUF"), { recursive: true });
    writeFileSync(desktopModel, Buffer.alloc(1_100_000));
    writeFileSync(mainStoreModel, Buffer.alloc(1_100_000));

    const { config, models } = await loadModules();
    config.setLocalModelRoots([desktopRoot, mainStoreRoot]);

    const selected = models.ensureActiveDefaultLocalModelConfig("work");
    const active = config.getModelConfig("work");

    expect(selected?.model).toBe(desktopModel);
    expect(active).toEqual({
      provider: "custom",
      model: desktopModel,
      baseUrl: "http://localhost:8080/v1",
    });
  });

  it("does not overwrite an existing active model", async () => {
    const desktopRoot = join(testHome, "Desktop", "AI_Models");
    const desktopModel = join(desktopRoot, "GGUF", "Phi-4-mini.gguf");
    mkdirSync(join(desktopRoot, "GGUF"), { recursive: true });
    writeFileSync(desktopModel, Buffer.alloc(1_100_000));

    const { config, models } = await loadModules();
    config.setLocalModelRoots([desktopRoot]);
    config.setModelConfig("openai", "gpt-4.1", "", "work");

    const selected = models.ensureActiveDefaultLocalModelConfig("work");

    expect(selected).toBeNull();
    expect(config.getModelConfig("work")).toEqual({
      provider: "openai",
      model: "gpt-4.1",
      baseUrl: "https://api.openai.com/v1",
    });
  });
});
