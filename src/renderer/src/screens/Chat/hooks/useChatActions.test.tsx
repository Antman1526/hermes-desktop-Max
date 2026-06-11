import { act, renderHook } from "@testing-library/react";
import type { RenderHookResult } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatActions } from "./useChatActions";
import type { ChatMessage } from "../types";

function installHermesAPI(
  api: Pick<Window["hermesAPI"], "sendMessage" | "abortChat">,
): void {
  Object.defineProperty(window, "hermesAPI", {
    configurable: true,
    value: api,
  });
}

function createHarness(initialMessages: ChatMessage[] = []): {
  result: RenderHookResult<
    ReturnType<typeof useChatActions>,
    unknown
  >["result"];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setIsLoading: ReturnType<typeof vi.fn>;
  getMessages: () => ChatMessage[];
} {
  let messagesState = initialMessages;
  const setMessages = vi.fn((update: SetStateAction<ChatMessage[]>) => {
    messagesState =
      typeof update === "function" ? update(messagesState) : update;
  }) as Dispatch<SetStateAction<ChatMessage[]>>;
  const setIsLoading = vi.fn();
  const localCommands = {
    isLocal: vi.fn(() => false),
    executeLocal: vi.fn(),
  };

  const { result } = renderHook(() =>
    useChatActions({
      profile: "default",
      hermesSessionId: null,
      messages: initialMessages,
      isLoading: false,
      setIsLoading,
      setMessages,
      chatInputRef: { current: null },
      localCommands,
      contextFolder: null,
    }),
  );

  return {
    result,
    setMessages,
    setIsLoading,
    getMessages: () => messagesState,
  };
}

describe("useChatActions", () => {
  const sendMessage = vi.fn();
  const abortChat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    installHermesAPI({ sendMessage, abortChat });
  });

  it("clears loading and surfaces an IPC failure when chat send rejects before streaming", async () => {
    sendMessage.mockRejectedValue(new Error("gateway spawn failed"));
    const harness = createHarness();

    await act(async () => {
      await harness.result.current.handleSend("hello");
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "hello",
      "default",
      undefined,
      [],
      undefined,
      undefined,
    );
    expect(harness.setIsLoading).toHaveBeenNthCalledWith(1, true);
    expect(harness.setIsLoading).toHaveBeenLastCalledWith(false);
    expect(harness.getMessages()).toEqual([
      expect.objectContaining({ role: "user", content: "hello" }),
      expect.objectContaining({
        role: "agent",
        content: "Error: gateway spawn failed",
      }),
    ]);
  });

  it("does not duplicate an error already surfaced by chat-error IPC", async () => {
    const harness = createHarness();
    sendMessage.mockImplementation(async () => {
      harness.setMessages((prev) => [
        ...prev,
        { id: "ipc-error", role: "agent", content: "Error: already surfaced" },
      ]);
      throw new Error("invoke rejected after chat-error");
    });

    await act(async () => {
      await harness.result.current.handleSend("hello");
    });

    expect(harness.getMessages()).toEqual([
      expect.objectContaining({ role: "user", content: "hello" }),
      expect.objectContaining({
        role: "agent",
        content: "Error: already surfaced",
      }),
    ]);
  });
});
