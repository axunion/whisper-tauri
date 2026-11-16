import { getCurrentWindow } from "@tauri-apps/api/window";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyUnlessFocused } from "../notify";

describe("notifyUnlessFocused", () => {
  beforeEach(() => {
    vi.mocked(sendNotification).mockReset();
  });

  it("notifies when the window is in the background", async () => {
    vi.mocked(getCurrentWindow().isFocused).mockResolvedValue(false);

    await notifyUnlessFocused("完了", "meeting.wav");

    expect(sendNotification).toHaveBeenCalledWith({
      title: "完了",
      body: "meeting.wav",
    });
  });

  it("stays quiet while the window is focused", async () => {
    vi.mocked(getCurrentWindow().isFocused).mockResolvedValue(true);

    await notifyUnlessFocused("完了", "meeting.wav");

    expect(sendNotification).not.toHaveBeenCalled();
  });
});
