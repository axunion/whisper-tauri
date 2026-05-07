import type { RouteSectionProps } from "@solidjs/router";
import { useLocation } from "@solidjs/router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createEffect, on, onMount, Show } from "solid-js";
import { Onboarding } from "~/components/onboarding";
import { SidebarProvider } from "~/components/ui/sidebar";
import { Toaster } from "~/components/ui/toast";
import { I18nProvider } from "~/i18n";
import { createSettings } from "~/primitives/createSettings";
import { applyTheme } from "~/primitives/createTheme";
import { AppSidebar } from "./AppSidebar";

async function showWindow(): Promise<void> {
  try {
    await getCurrentWindow().show();
  } catch {
    // ignore
  }
}

export function AppLayout(props: RouteSectionProps) {
  const settings = createSettings();
  const location = useLocation();
  let mainRef: HTMLElement | undefined;

  onMount(() => {
    settings.load();
  });

  createEffect(
    on(
      () => location.pathname,
      () => {
        mainRef?.scrollTo({ top: 0, behavior: "instant" });
      },
      { defer: true },
    ),
  );

  // Show window once settings are loaded and onboarding is completed.
  // (Onboarding handles its own resize + show.)
  let windowShown = false;
  createEffect(
    on(
      () => settings.isLoaded() && settings.onboardingCompleted(),
      (ready) => {
        if (ready && !windowShown) {
          windowShown = true;
          showWindow();
        }
      },
    ),
  );

  applyTheme(settings.theme);

  return (
    <I18nProvider locale={settings.language()}>
      <Show when={settings.isLoaded()}>
        <Show
          when={!settings.onboardingCompleted()}
          fallback={
            <SidebarProvider>
              <AppSidebar />
              <main
                ref={mainRef}
                class="main-scroll flex min-h-0 flex-1 flex-col p-6"
              >
                {props.children}
              </main>
            </SidebarProvider>
          }
        >
          <Onboarding settings={settings} />
        </Show>
      </Show>
      <Toaster />
    </I18nProvider>
  );
}
