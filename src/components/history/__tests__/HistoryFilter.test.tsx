import { within } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { ja } from "~/i18n/dictionaries/ja";
import { renderWithI18n } from "~/test/helpers";
import type { HistoryFilter as HistoryFilterType } from "~/types";
import { HistoryFilter } from "../HistoryFilter";

/**
 * `history.created_at` is stored as UTC wall-clock, so the bounds this component
 * emits have to be UTC too — while still landing on the *local* midnights the
 * user means by "last 7 days". The assertions compare instants and local
 * calendar days rather than literal strings, so they hold in any runner
 * timezone and across DST transitions.
 */
function emitRange(
  label: string,
  filter: HistoryFilterType = {},
): HistoryFilterType {
  const onFilterChange = vi.fn();
  const { container, unmount } = renderWithI18n(() => (
    <HistoryFilter filter={filter} onFilterChange={onFilterChange} />
  ));
  within(container).getByText(label).click();
  expect(onFilterChange).toHaveBeenCalledTimes(1);
  unmount();
  return onFilterChange.mock.calls[0]?.[0] as HistoryFilterType;
}

/** Interprets a stored-format bound as the instant it denotes. */
function toInstant(bound: string | undefined): Date {
  return new Date(`${bound ?? ""}Z`);
}

/** Local midnight `offset` days from today. */
function localMidnight(offset: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
}

describe("HistoryFilter date bounds", () => {
  it("emits suffix-less 19-character bounds matching the stored format", () => {
    const filter = emitRange(ja.history.filterLast7days);
    const shape = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    expect(filter.dateFrom).toMatch(shape);
    expect(filter.dateTo).toMatch(shape);
  });

  it("covers 7 local days ending at the next local midnight", () => {
    const filter = emitRange(ja.history.filterLast7days);
    expect(toInstant(filter.dateFrom).getTime()).toBe(
      localMidnight(-6).getTime(),
    );
    expect(toInstant(filter.dateTo).getTime()).toBe(localMidnight(1).getTime());
  });

  it("covers 30 local days for the 30-day range", () => {
    const filter = emitRange(ja.history.filterLast30days);
    expect(toInstant(filter.dateFrom).getTime()).toBe(
      localMidnight(-29).getTime(),
    );
    expect(toInstant(filter.dateTo).getTime()).toBe(localMidnight(1).getTime());
  });

  it("clears both bounds when switching back to all", () => {
    const active = emitRange(ja.history.filterLast7days);
    expect(emitRange(ja.history.filterAll, active)).toEqual({});
  });
});
