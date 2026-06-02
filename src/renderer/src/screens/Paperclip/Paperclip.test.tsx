import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../components/I18nProvider";
import Paperclip from "./Paperclip";

const mockApi = {
  getPaperclipConfig: vi.fn(),
  paperclipStatus: vi.fn(),
  setPaperclipConfig: vi.fn(),
  startPaperclip: vi.fn(),
  stopPaperclip: vi.fn(),
  openPaperclip: vi.fn(),
};

describe("Paperclip screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getPaperclipConfig.mockResolvedValue({
      serverUrl: "http://127.0.0.1:3100",
      telemetryDisabled: true,
    });
    mockApi.paperclipStatus
      .mockResolvedValueOnce({
        serverUrl: "http://127.0.0.1:3100",
        running: false,
        managed: false,
        launcherAvailable: true,
        launcherDetail: "npx 11.6.2",
        health: "unreachable",
      })
      .mockResolvedValue({
        serverUrl: "http://127.0.0.1:3100",
        running: true,
        managed: true,
        launcherAvailable: true,
        launcherDetail: "npx 11.6.2",
        health: "ok",
      });
    mockApi.startPaperclip.mockResolvedValue({ success: true });

    Object.defineProperty(window, "hermesAPI", {
      value: mockApi,
      configurable: true,
    });
  });

  it("opens the dashboard after a successful start", async () => {
    render(
      <I18nProvider>
        <Paperclip />
      </I18nProvider>,
    );

    const startButton = await screen.findByRole("button", { name: /start/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockApi.startPaperclip).toHaveBeenCalledTimes(1);
      expect(mockApi.openPaperclip).toHaveBeenCalledTimes(1);
    });
  });
});
