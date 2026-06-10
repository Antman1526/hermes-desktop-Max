import { describe, expect, it } from "vitest";
import {
  getFeatureCapability,
  isFeatureAvailable,
  type ConnectionMode,
} from "./capabilities";

describe("Layout feature capabilities", () => {
  it("keeps SSH-backed features available while pure HTTP remote mode is limited", () => {
    expect(isFeatureAvailable("memory", "local")).toBe(true);
    expect(isFeatureAvailable("memory", "ssh")).toBe(true);
    expect(isFeatureAvailable("memory", "remote")).toBe(false);

    expect(isFeatureAvailable("gateway", "local")).toBe(true);
    expect(isFeatureAvailable("gateway", "ssh")).toBe(true);
    expect(isFeatureAvailable("gateway", "remote")).toBe(false);

    expect(isFeatureAvailable("paperclip", "remote")).toBe(true);
    expect(isFeatureAvailable("office", "remote")).toBe(true);
  });

  it("returns consistent capability metadata for every mode", () => {
    const modes: ConnectionMode[] = ["local", "ssh", "remote"];

    for (const mode of modes) {
      const capability = getFeatureCapability("providers", mode);
      expect(capability.feature).toBe("providers");
      expect(capability.mode).toBe(mode);
      expect(capability.availability).toMatch(/^(available|read-only|unavailable)$/);
    }
  });
});
