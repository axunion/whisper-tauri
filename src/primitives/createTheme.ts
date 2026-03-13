import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";
import type { AppSettings } from "~/types";

function resolveSystemTheme(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyThemeToDOM(theme: AppSettings["theme"]): void {
  const isDark =
    theme === "dark" || (theme === "system" && resolveSystemTheme());
  const el = document.documentElement;
  if (isDark) {
    el.classList.add("dark");
    el.dataset.kbTheme = "dark";
  } else {
    el.classList.remove("dark");
    el.dataset.kbTheme = "light";
  }
}

export function applyTheme(theme: Accessor<AppSettings["theme"]>): void {
  createEffect(() => {
    const value = theme();
    applyThemeToDOM(value);

    if (value === "system" && typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        applyThemeToDOM(e.matches ? "dark" : "light");
      };
      mq.addEventListener("change", handler);
      onCleanup(() => mq.removeEventListener("change", handler));
    }
  });
}
