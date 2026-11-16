import { fireEvent, screen, waitFor } from "@solidjs/testing-library";
import { open } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "~/test/helpers";
import type { FileInfo } from "~/types";
import { FileSelector } from "../FileSelector";

const selectedFile: FileInfo = {
  path: "/a/talk.mp3",
  name: "talk.mp3",
  size: 0,
};

/** Lets a resolved dialog promise run its continuation before asserting absence. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("FileSelector", () => {
  beforeEach(() => {
    vi.mocked(open).mockReset();
  });

  it("opens a multi-select dialog from the empty state and forwards the picked paths", async () => {
    vi.mocked(open).mockResolvedValueOnce(["/a/one.wav", "/a/two.mp3"]);
    const onFilesAdd = vi.fn();
    const onFileSelect = vi.fn();
    renderWithI18n(() => (
      <FileSelector
        file={null}
        onFileSelect={onFileSelect}
        onFilesAdd={onFilesAdd}
        onFileClear={() => {}}
      />
    ));

    fireEvent.click(
      screen.getByRole("button", { name: /クリックまたはドロップ/ }),
    );

    await waitFor(() =>
      expect(onFilesAdd).toHaveBeenCalledWith(["/a/one.wav", "/a/two.mp3"]),
    );
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: true }),
    );
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("opens a single-select dialog from change file and forwards the picked file", async () => {
    vi.mocked(open).mockResolvedValueOnce("/a/new.mp3");
    const onFileSelect = vi.fn();
    const onFilesAdd = vi.fn();
    renderWithI18n(() => (
      <FileSelector
        file={selectedFile}
        onFileSelect={onFileSelect}
        onFilesAdd={onFilesAdd}
        onFileClear={() => {}}
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: "ファイルを変更" }));

    await waitFor(() =>
      expect(onFileSelect).toHaveBeenCalledWith({
        path: "/a/new.mp3",
        name: "new.mp3",
        size: 0,
      }),
    );
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: false }),
    );
    expect(onFilesAdd).not.toHaveBeenCalled();
  });

  it("calls neither callback when the add dialog is cancelled", async () => {
    vi.mocked(open).mockResolvedValueOnce(null);
    const onFileSelect = vi.fn();
    const onFilesAdd = vi.fn();
    renderWithI18n(() => (
      <FileSelector
        file={null}
        onFileSelect={onFileSelect}
        onFilesAdd={onFilesAdd}
        onFileClear={() => {}}
      />
    ));

    fireEvent.click(
      screen.getByRole("button", { name: /クリックまたはドロップ/ }),
    );

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    await settle();
    expect(onFilesAdd).not.toHaveBeenCalled();
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("calls neither callback when the change dialog is cancelled", async () => {
    vi.mocked(open).mockResolvedValueOnce(null);
    const onFileSelect = vi.fn();
    const onFilesAdd = vi.fn();
    renderWithI18n(() => (
      <FileSelector
        file={selectedFile}
        onFileSelect={onFileSelect}
        onFilesAdd={onFilesAdd}
        onFileClear={() => {}}
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: "ファイルを変更" }));

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    await settle();
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(onFilesAdd).not.toHaveBeenCalled();
  });
});
