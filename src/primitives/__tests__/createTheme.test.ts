import { afterEach, describe, expect, it, vi } from "vitest";
import { applyThemeToDOM } from "../createTheme";

function resetDOM() {
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.kbTheme;
}

describe("applyThemeToDOM", () => {
  afterEach(() => {
    resetDOM();
    vi.restoreAllMocks();
  });

  describe("light", () => {
    it("should remove dark class and set data-kb-theme to light", () => {
      document.documentElement.classList.add("dark");

      applyThemeToDOM("light");

      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.dataset.kbTheme).toBe("light");
    });
  });

  describe("dark", () => {
    it("should add dark class and set data-kb-theme to dark", () => {
      applyThemeToDOM("dark");

      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.dataset.kbTheme).toBe("dark");
    });
  });

  describe("system", () => {
    it("should apply dark when system prefers dark", () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });

      applyThemeToDOM("system");

      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.dataset.kbTheme).toBe("dark");
    });

    it("should apply light when system prefers light", () => {
      document.documentElement.classList.add("dark");
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      applyThemeToDOM("system");

      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.dataset.kbTheme).toBe("light");
    });
  });
});
