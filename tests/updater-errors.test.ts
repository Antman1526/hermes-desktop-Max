import { describe, expect, it } from "vitest";

import { shouldSuppressUpdateErrorMessage } from "../src/main/updater-errors";

describe("updater error classification", () => {
  it("suppresses GitHub release-feed misses from ad-hoc packaged builds", () => {
    expect(
      shouldSuppressUpdateErrorMessage("No published versions on GitHub"),
    ).toBe(true);
  });

  it("keeps actionable updater errors visible to the user", () => {
    expect(shouldSuppressUpdateErrorMessage("Update download failed")).toBe(
      false,
    );
  });
});
