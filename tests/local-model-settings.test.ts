import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_HOME = join(tmpdir(), `hermes-local-settings-${Date.now()}`);

vi.mock("../src/main/installer", () => ({
  HERMES_HOME: TEST_HOME,
  expectedEnvKeyForModel: () => "OPENAI_API_KEY",
}));

describe("local model root settings", () => {
  beforeEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    mkdirSync(TEST_HOME, { recursive: true });
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
  });

  it("uses Antman's personal defaults when no roots are configured", async () => {
    const { DEFAULT_LOCAL_MODEL_ROOTS, getLocalModelRoots } =
      await import("../src/main/config");

    expect(getLocalModelRoots()).toEqual(DEFAULT_LOCAL_MODEL_ROOTS);
  });

  it("trims and deduplicates configured roots", async () => {
    const { getLocalModelRoots, setLocalModelRoots } =
      await import("../src/main/config");

    setLocalModelRoots([" /tmp/models ", "/tmp/models", "", " /other "]);

    expect(getLocalModelRoots()).toEqual(["/tmp/models", "/other"]);
  });

  it("falls back to defaults when saved roots are empty", async () => {
    const {
      DEFAULT_LOCAL_MODEL_ROOTS,
      getLocalModelRoots,
      setLocalModelRoots,
    } = await import("../src/main/config");

    setLocalModelRoots(["", "   "]);

    expect(getLocalModelRoots()).toEqual(DEFAULT_LOCAL_MODEL_ROOTS);
  });
});
