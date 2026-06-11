import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../components/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../components/common/BrandLogo", () => ({
  default: () => <span data-testid="brand-logo" />,
}));

vi.mock("../../hooks/useDiscoveredModels", () => ({
  useDiscoveredModels: () => ({
    models: [],
    status: "idle",
    cached: false,
    freeModels: [],
  }),
}));

import Providers from "./Providers";

function installHermesApi(
  overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {},
): Record<string, ReturnType<typeof vi.fn>> {
  const api = {
    getEnv: vi.fn().mockResolvedValue({}),
    getModelConfig: vi.fn().mockResolvedValue({
      provider: "auto",
      model: "",
      baseUrl: "",
    }),
    getCredentialPool: vi.fn().mockResolvedValue({}),
    setModelConfig: vi.fn().mockResolvedValue(true),
    addModel: vi.fn().mockResolvedValue({}),
    setEnv: vi.fn().mockResolvedValue(true),
    addCredentialPoolEntry: vi.fn().mockResolvedValue([
      {
        id: "cred-1",
        label: "Main",
        auth_type: "api_key",
        api_key: "sk-test",
      },
    ]),
    setCredentialPool: vi.fn().mockResolvedValue(true),
    oauthLogin: vi.fn().mockResolvedValue({ success: true }),
    cancelOAuthLogin: vi.fn().mockResolvedValue(true),
    onOAuthLoginProgress: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };

  Object.defineProperty(window, "hermesAPI", {
    configurable: true,
    value: api,
  });

  return api;
}

describe("Providers profile-aware credential pool", () => {
  it("loads credential pool for the selected profile", async () => {
    const api = installHermesApi();

    render(<Providers profile="research" visible />);

    await waitFor(() => {
      expect(api.getCredentialPool).toHaveBeenCalledWith("research");
    });
  });

  it("adds credential-pool entries to the selected profile", async () => {
    const api = installHermesApi();
    const view = render(<Providers profile="research" visible />);

    await waitFor(() => {
      expect(api.getEnv).toHaveBeenCalledWith("research");
    });

    const poolSelect = view.container.querySelector(
      ".settings-pool-add select",
    ) as HTMLSelectElement | null;
    expect(poolSelect).toBeTruthy();

    const keyInput = view.container.querySelector(
      '.settings-pool-add input[type="password"]',
    ) as HTMLInputElement | null;
    expect(keyInput).toBeTruthy();

    const addButton = Array.from(
      view.container.querySelectorAll("button"),
    ).find((button) => button.textContent === "settings.add") as
      | HTMLButtonElement
      | undefined;
    expect(addButton).toBeTruthy();

    await act(async () => {
      fireEvent.change(poolSelect!, { target: { value: "openai" } });
      fireEvent.change(keyInput!, { target: { value: "sk-test" } });
    });

    await act(async () => {
      fireEvent.click(addButton!);
    });

    expect(api.addCredentialPoolEntry).toHaveBeenCalledWith(
      "openai",
      "sk-test",
      "",
      "research",
    );
  });
});
