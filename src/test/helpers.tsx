import { render } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import type { Locale } from "~/i18n";
import { I18nProvider } from "~/i18n";

export function renderWithI18n(ui: () => JSX.Element, locale: Locale = "ja") {
  return render(() => <I18nProvider locale={locale}>{ui()}</I18nProvider>);
}
