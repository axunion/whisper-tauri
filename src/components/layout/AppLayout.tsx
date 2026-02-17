import type { RouteSectionProps } from "@solidjs/router";
import { SidebarProvider } from "~/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function AppLayout(props: RouteSectionProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main class="flex min-h-svh flex-1 flex-col overflow-auto p-6">
        {props.children}
      </main>
    </SidebarProvider>
  );
}
