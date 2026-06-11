import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useModelConfig } from "./useModelConfig";

vi.mock("../../../components/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

function installHermesAPI(
  api: Pick<
    Window["hermesAPI"],
    "getModelConfig" | "listModels" | "setModelConfig" | "startLocalModelServer"
  >,
): void {
  Object.defineProperty(window, "hermesAPI", {
    configurable: true,
    value: api,
  });
}

describe("useModelConfig", () => {
  const getModelConfig = vi.fn();
  const listModels = vi.fn();
  const setModelConfig = vi.fn();
  const startLocalModelServer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getModelConfig.mockResolvedValue({
      provider: "auto",
      model: "",
      baseUrl: "",
    });
    listModels.mockResolvedValue([]);
    setModelConfig.mockResolvedValue(true);
    startLocalModelServer.mockResolvedValue({
      running: true,
      managed: true,
      launcherAvailable: true,
      launcherPath: "/opt/homebrew/bin/llama-server",
      modelPath: "/models/Hermes.gguf",
      baseUrl: "http://localhost:8081/v1",
      pid: 1234,
    });
    installHermesAPI({
      getModelConfig,
      listModels,
      setModelConfig,
      startLocalModelServer,
    });
  });

  it("saves the actual local model server base URL returned after auto-port selection", async () => {
    const { result } = renderHook(() => useModelConfig());

    await act(async () => {
      await result.current.selectModel(
        "custom",
        "/models/Hermes.gguf",
        "http://localhost:8080/v1",
        {
          launchable: true,
          modelPath: "/models/Hermes.gguf",
        },
      );
    });

    expect(startLocalModelServer).toHaveBeenCalledWith("/models/Hermes.gguf");
    expect(setModelConfig).toHaveBeenCalledWith(
      "custom",
      "/models/Hermes.gguf",
      "http://localhost:8081/v1",
      undefined,
    );
  });

  it("reports local model readiness after auto-port startup", async () => {
    const { result } = renderHook(() => useModelConfig());

    await act(async () => {
      await result.current.selectModel(
        "custom",
        "/models/Hermes.gguf",
        "http://localhost:8080/v1",
        {
          launchable: true,
          modelPath: "/models/Hermes.gguf",
        },
      );
    });

    expect(result.current.localModelReadiness).toEqual({
      state: "ready",
      message: "Local model ready at http://localhost:8081/v1",
    });
  });

  it("does not select unavailable local file models", async () => {
    const { result } = renderHook(() => useModelConfig());

    await act(async () => {
      await result.current.selectModel(
        "custom",
        "/Volumes/MainStore/Development/AI_Models/GGUF/Hermes.gguf",
        "http://localhost:8080/v1",
        {
          launchable: true,
          modelPath:
            "/Volumes/MainStore/Development/AI_Models/GGUF/Hermes.gguf",
          available: false,
          unavailableReason:
            "Model folder is not mounted: /Volumes/MainStore/Development/AI_Models",
        },
      );
    });

    expect(startLocalModelServer).not.toHaveBeenCalled();
    expect(setModelConfig).not.toHaveBeenCalled();
    expect(result.current.localModelReadiness).toEqual({
      state: "error",
      message:
        "Model folder is not mounted: /Volumes/MainStore/Development/AI_Models",
    });
  });

  it("reports local model startup errors without saving the broken model", async () => {
    startLocalModelServer.mockResolvedValueOnce({
      running: false,
      managed: false,
      launcherAvailable: false,
      modelPath: "/models/Hermes.gguf",
      baseUrl: "http://localhost:8080/v1",
      error: "llama-server is not installed.",
    });
    const { result } = renderHook(() => useModelConfig());

    await act(async () => {
      await result.current.selectModel(
        "custom",
        "/models/Hermes.gguf",
        "http://localhost:8080/v1",
        {
          launchable: true,
          modelPath: "/models/Hermes.gguf",
        },
      );
    });

    expect(setModelConfig).not.toHaveBeenCalled();
    expect(result.current.localModelReadiness).toEqual({
      state: "error",
      message: "llama-server is not installed.",
    });
  });
});
