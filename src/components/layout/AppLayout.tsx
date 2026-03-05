import type { RouteSectionProps } from "@solidjs/router";
import { onMount } from "solid-js";
import { SidebarProvider } from "~/components/ui/sidebar";
import { Toaster } from "~/components/ui/toast";
import { I18nProvider } from "~/i18n";
import { createSettings } from "~/primitives/createSettings";
import { applyTheme } from "~/primitives/createTheme";
import { AppSidebar } from "./AppSidebar";

export function AppLayout(props: RouteSectionProps) {
  const settings = createSettings();

  onMount(() => {
    settings.load();
  });

  applyTheme(settings.theme);

  return (
    <I18nProvider locale={settings.language()}>
      <SidebarProvider>
        <AppSidebar />
        <main class="flex min-h-svh flex-1 flex-col overflow-auto p-6 pb-16">
          {props.children}
        </main>
        <Toaster />
      </SidebarProvider>
    </I18nProvider>
  );
}
