import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAPERCLIP_URL,
  mergePaperclipConfigData,
  normalizePaperclipUrl,
  readPaperclipConfigFromData,
} from "../src/main/paperclip";

describe("Paperclip sidecar config", () => {
  it("normalizes empty and bare Paperclip URLs", () => {
    expect(normalizePaperclipUrl("")).toBe(DEFAULT_PAPERCLIP_URL);
    expect(normalizePaperclipUrl("localhost:3100/")).toBe(
      "http://localhost:3100",
    );
    expect(normalizePaperclipUrl("http://127.0.0.1:3100///")).toBe(
      "http://127.0.0.1:3100",
    );
  });

  it("rejects non-http Paperclip URLs", () => {
    expect(normalizePaperclipUrl("file:///tmp/paperclip")).toBe(
      DEFAULT_PAPERCLIP_URL,
    );
    expect(normalizePaperclipUrl("javascript://alert(1)")).toBe(
      DEFAULT_PAPERCLIP_URL,
    );
  });

  it("reads defaults when desktop config has no Paperclip block", () => {
    expect(readPaperclipConfigFromData({})).toEqual({
      serverUrl: DEFAULT_PAPERCLIP_URL,
      telemetryDisabled: true,
    });
  });

  it("merges Paperclip config without discarding unrelated desktop settings", () => {
    const next = mergePaperclipConfigData(
      { connectionMode: "local", remoteUrl: "http://example.test" },
      { serverUrl: "localhost:3100/", telemetryDisabled: false },
    );

    expect(next).toEqual({
      connectionMode: "local",
      remoteUrl: "http://example.test",
      paperclip: {
        serverUrl: "http://localhost:3100",
        telemetryDisabled: false,
      },
    });
  });
});
