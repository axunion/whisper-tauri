import type { RouteSectionProps } from "@solidjs/router";
import { onMount } from "solid-js";
import { SidebarProvider } from "~/components/ui/sidebar";
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
    <SidebarProvider>
      <AppSidebar />
      <main class="flex min-h-svh flex-1 flex-col overflow-auto p-6">
        {props.children}
      </main>
    </SidebarProvider>
  );
}
