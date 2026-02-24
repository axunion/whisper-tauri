import { A, useLocation } from "@solidjs/router";
import {
  FiBarChart2,
  FiClock,
  FiFileText,
  FiSettings,
  FiTool,
} from "solid-icons/fi";
import { For, Show } from "solid-js";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "~/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", href: "/", icon: FiBarChart2 },
  { title: "Transcription", href: "/transcription", icon: FiFileText },
  { title: "History", href: "/history", icon: FiClock },
  { title: "Settings", href: "/settings", icon: FiSettings },
];

const devMenuItems = [{ title: "Dev", href: "/dev", icon: FiTool }];

export function AppSidebar() {
  const location = useLocation();
  const sidebar = useSidebar();
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
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </For>
          </SidebarMenu>
        </SidebarGroup>

        <Show when={import.meta.env.DEV}>
          <hr class="mx-2 border-sidebar-border" />
          <SidebarGroup>
            <SidebarMenu>
              <For each={devMenuItems}>
                {(item) => (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      as={A}
                      href={item.href}
                      isActive={isActive(item.href)}
                    >
                      <item.icon class="size-4 shrink-0" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </For>
            </SidebarMenu>
          </SidebarGroup>
        </Show>
      </SidebarContent>
    </Sidebar>
  );
}
