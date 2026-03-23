import { A, useLocation } from "@solidjs/router";
import {
  FiBarChart2,
  FiClock,
  FiFileText,
  FiSettings,
  FiTool,
} from "solid-icons/fi";
import { For, Show } from "solid-js";
import { DownloadIndicator } from "~/components/layout/DownloadIndicator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "~/components/ui/sidebar";
import type { DictionaryKey } from "~/i18n";
import { useI18n } from "~/i18n";

const menuItems = [
  {
    titleKey: "nav.dashboard" as const satisfies DictionaryKey,
    href: "/",
    icon: FiBarChart2,
  },
  {
    titleKey: "nav.transcription" as const satisfies DictionaryKey,
    href: "/transcription",
    icon: FiFileText,
  },
  {
    titleKey: "nav.history" as const satisfies DictionaryKey,
    href: "/history",
    icon: FiClock,
  },
  {
    titleKey: "nav.settings" as const satisfies DictionaryKey,
    href: "/settings",
    icon: FiSettings,
  },
];

const devMenuItems = [
  {
    titleKey: "nav.dev" as const satisfies DictionaryKey,
    href: "/dev",
    icon: FiTool,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const sidebar = useSidebar();
  const { t } = useI18n();
  const isActive = (href: string) =>
    href === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(href);

  return (
    <Sidebar role="navigation" collapsible="icon">
      <SidebarHeader>
        <div class="flex items-center group-data-[collapsible=icon]:justify-center">
          <Show when={sidebar.state() === "expanded"}>
            <span class="whitespace-nowrap px-2 text-lg font-bold">
              Whisper Tauri
            </span>
          </Show>
          <SidebarTrigger class="ml-auto shrink-0" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <For each={menuItems}>
              {(item) => (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    as={A}
                    href={item.href}
                    isActive={isActive(item.href)}
                  >
                    <item.icon class="size-4 shrink-0" />
                    <span>{t(item.titleKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </For>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <DownloadIndicator />
      <Show when={import.meta.env.DEV}>
        <SidebarFooter>
          <SidebarMenu>
            <For each={devMenuItems}>
              {(item) => (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    as={A}
                    href={item.href}
                    isActive={isActive(item.href)}
                    class="text-muted-foreground"
                  >
                    <item.icon class="size-4 shrink-0" />
                    <span>{t(item.titleKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </For>
          </SidebarMenu>
        </SidebarFooter>
      </Show>
    </Sidebar>
  );
}
