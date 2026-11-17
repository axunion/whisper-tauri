import { MemoryRouter, Route, useNavigate } from "@solidjs/router";
import { render } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { onMount } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "~/i18n";
import type { SettingsSection } from "~/types";
import Settings from "../Settings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve([])),
  convertFileSrc: vi.fn((path: string) => path),
}));

const SECTIONS: SettingsSection[] = [
  "settings-models",
  "settings-ai",
  "settings-ffmpeg",
  "settings-notion",
];

/** Arrives at /settings the way a link does, optionally carrying a section in state. */
function linkTo(section?: SettingsSection) {
  return function Link() {
    const navigate = useNavigate();
    onMount(() =>
      navigate("/settings", section ? { state: { section } } : undefined),
    );
    return null;
  };
}

function renderSettings(section?: SettingsSection) {
  return render(() => (
    <I18nProvider locale="ja">
      <MemoryRouter>
        <Route path="/" component={linkTo(section)} />
        <Route path="/settings" component={Settings} />
      </MemoryRouter>
    </I18nProvider>
  ));
}

describe("Settings page sections", () => {
  let scrolled: string[];
  const originalScroll = Element.prototype.scrollIntoView;

  beforeEach(() => {
    vi.mocked(invoke).mockImplementation(() => Promise.resolve([]));
    scrolled = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScroll;
  });

  it("renders an element for every section a link can land on", async () => {
    renderSettings();
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
    for (const id of SECTIONS) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it.each(SECTIONS)(
    "scrolls to %s when arrived at with that section",
    async (section) => {
      renderSettings(section);
      await vi.waitFor(() => expect(scrolled).toEqual([section]));
    },
  );

  it("does not scroll when arriving without a section", async () => {
    renderSettings();
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(scrolled).toEqual([]);
  });
});
