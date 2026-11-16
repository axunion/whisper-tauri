import { fireEvent, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "~/test/helpers";
import { ResultTimelineTab } from "../ResultTimelineTab";

const segments = [
  { start: 0, end: 2000, text: "最初の発言" },
  { start: 2000, end: 5000, text: "次の発言" },
];

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
});
