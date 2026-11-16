import { fireEvent, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "~/test/helpers";
import { ResultTimelineTab } from "../ResultTimelineTab";

const segments = [
  { start: 0, end: 2000, text: "最初の発言" },
  { start: 2000, end: 5000, text: "次の発言" },
];

function editButton(index: number): HTMLElement {
  const button = screen.getAllByRole("button", { name: "この行を編集" })[index];
  if (!button) throw new Error(`no edit button at ${index}`);
  return button;
}

describe("ResultTimelineTab", () => {
  it("renders plain rows when there is no audio to seek", () => {
    renderWithI18n(() => <ResultTimelineTab segments={segments} />);

    expect(screen.getByText("最初の発言")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("seeks to the start of the clicked segment", () => {
    const onSeek = vi.fn();
    renderWithI18n(() => (
      <ResultTimelineTab segments={segments} onSeek={onSeek} />
    ));

    fireEvent.click(screen.getByRole("button", { name: /次の発言/ }));

    expect(onSeek).toHaveBeenCalledWith(2000);
  });

  it("marks only the segment that contains the playback position", () => {
    renderWithI18n(() => (
      <ResultTimelineTab
        segments={segments}
        positionMs={2000}
        onSeek={() => {}}
      />
    ));

    expect(screen.getByRole("button", { name: /次の発言/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /最初の発言/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks nothing before playback has reported a position", () => {
    renderWithI18n(() => (
      <ResultTimelineTab segments={segments} onSeek={() => {}} />
    ));

    for (const row of screen.getAllByRole("button")) {
      expect(row).not.toHaveAttribute("aria-current");
    }
  });

  it("offers no edit control unless editing is enabled", () => {
    renderWithI18n(() => <ResultTimelineTab segments={segments} />);

    expect(screen.queryByRole("button", { name: "この行を編集" })).toBeNull();
  });

  it("reports the corrected text of the edited segment on Enter", () => {
    const onEdit = vi.fn();
    renderWithI18n(() => (
      <ResultTimelineTab segments={segments} onEdit={onEdit} />
    ));

    fireEvent.click(editButton(1));
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("次の発言");
    fireEvent.input(input, { target: { value: "  次の発表  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEdit).toHaveBeenCalledWith(1, "次の発表");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("discards the edit on Escape", () => {
    const onEdit = vi.fn();
    renderWithI18n(() => (
      <ResultTimelineTab segments={segments} onEdit={onEdit} />
    ));

    fireEvent.click(editButton(0));
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "別の文" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("最初の発言")).toBeInTheDocument();
  });

  it("confirms the edit when the field loses focus", () => {
    const onEdit = vi.fn();
    renderWithI18n(() => (
      <ResultTimelineTab segments={segments} onEdit={onEdit} />
    ));

    fireEvent.click(editButton(0));
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "修正した発言" } });
    fireEvent.blur(input);

    expect(onEdit).toHaveBeenCalledWith(0, "修正した発言");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps aria-current on the active segment while editing is enabled", () => {
    renderWithI18n(() => (
      <ResultTimelineTab
        segments={segments}
        positionMs={2000}
        onSeek={() => {}}
        onEdit={() => {}}
      />
    ));

    expect(screen.getByRole("button", { name: /次の発言/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("allows only one row to be edited at a time", () => {
    renderWithI18n(() => (
      <ResultTimelineTab segments={segments} onEdit={() => {}} />
    ));

    const [firstEdit, secondEdit] = screen.getAllByRole("button", {
      name: "この行を編集",
    });
    fireEvent.click(firstEdit as HTMLElement);
    fireEvent.click(secondEdit as HTMLElement);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveValue("次の発言");
  });

  it("reports nothing when the text was not changed", () => {
    const onEdit = vi.fn();
    renderWithI18n(() => (
      <ResultTimelineTab segments={segments} onEdit={onEdit} />
    ));

    fireEvent.click(editButton(0));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("does not save on a blur that follows Escape", () => {
    const onEdit = vi.fn();
    renderWithI18n(() => (
      <ResultTimelineTab segments={segments} onEdit={onEdit} />
    ));

    fireEvent.click(editButton(0));
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "別の文" } });
    fireEvent.keyDown(input, { key: "Escape" });
    // WebKit fires blur on the input as it is removed; jsdom does not.
    fireEvent.blur(input);

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("saves once when blur follows Enter", () => {
    const onEdit = vi.fn();
    renderWithI18n(() => (
      <ResultTimelineTab segments={segments} onEdit={onEdit} />
    ));

    fireEvent.click(editButton(0));
    const input = screen.getByRole("textbox");
    fireEvent.input(input, { target: { value: "別の文" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
