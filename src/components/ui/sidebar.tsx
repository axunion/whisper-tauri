import type { PolymorphicProps } from "@kobalte/core";
import { Polymorphic } from "@kobalte/core";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type {
  Accessor,
  Component,
  ComponentProps,
  JSX,
  ValidComponent,
} from "solid-js";
import {
  createContext,
  createEffect,
  createSignal,
  Match,
  mergeProps,
  onCleanup,
  Switch,
  splitProps,
  useContext,
} from "solid-js";
import type { ButtonProps } from "~/components/ui/Button";
import { Button } from "~/components/ui/Button";
import { useI18n } from "~/i18n";
import { cn } from "~/lib/utils";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContext = {
  state: Accessor<"expanded" | "collapsed">;
  open: Accessor<boolean>;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContext | null>(null);

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a Sidebar.");
  }
  return context;
}

type SidebarProviderProps = Omit<ComponentProps<"div">, "style"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: JSX.CSSProperties;
};

const SidebarProvider: Component<SidebarProviderProps> = (rawProps) => {
  const props = mergeProps({ defaultOpen: true }, rawProps);
  const [local, others] = splitProps(props, [
    "defaultOpen",
    "open",
    "onOpenChange",
    "class",
    "style",
    "children",
  ]);

  const [_open, _setOpen] = createSignal(local.defaultOpen);
  const open = () => local.open ?? _open();
  const setOpen = (value: boolean | ((value: boolean) => boolean)) => {
    if (local.onOpenChange) {
      return local.onOpenChange?.(
        typeof value === "function" ? value(open()) : value,
      );
    }
    _setOpen(value);
  };

  const toggleSidebar = () => {
    setOpen((prev) => !prev);
  };

  createEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const state = () => (open() ? "expanded" : "collapsed");

  const contextValue = {
    state,
    open,
    setOpen,
    toggleSidebar,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        style={{
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
          ...local.style,
        }}
        class={cn(
          "group/sidebar-wrapper flex h-svh w-full overflow-hidden text-sidebar-foreground has-[[data-variant=inset]]:bg-sidebar",
          local.class,
        )}
        {...others}
      >
        {local.children}
      </div>
    </SidebarContext.Provider>
  );
};

type SidebarProps = ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
};

const Sidebar: Component<SidebarProps> = (rawProps) => {
  const props = mergeProps<SidebarProps[]>(
    {
      side: "left",
      variant: "sidebar",
      collapsible: "offcanvas",
    },
    rawProps,
  );
  const [local, others] = splitProps(props, [
    "side",
    "variant",
    "collapsible",
    "class",
    "children",
  ]);

  const { state } = useSidebar();

  return (
    <Switch>
      <Match when={local.collapsible === "none"}>
        <div
          class={cn(
            "w-(--sidebar-width) flex h-full flex-col bg-sidebar text-sidebar-foreground",
            local.class,
          )}
          {...others}
        >
          {local.children}
        </div>
      </Match>
      <Match when={true}>
        <div
          class="group peer hidden md:block"
          data-state={state()}
          data-collapsible={state() === "collapsed" ? local.collapsible : ""}
          data-variant={local.variant}
          data-side={local.side}
        >
          <div
            class={cn(
              "w-(--sidebar-width) relative h-svh bg-transparent transition-[width] duration-200 ease-linear",
              "group-data-[collapsible=offcanvas]:w-0",
              "group-data-[side=right]:rotate-180",
              local.variant === "floating" || local.variant === "inset"
                ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
                : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
            )}
          />
          <div
            class={cn(
              "w-(--sidebar-width) fixed inset-y-0 z-10 hidden h-svh transition-[left,right,width] duration-200 ease-linear md:flex",
              local.side === "left"
                ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
                : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
              local.variant === "floating" || local.variant === "inset"
                ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
                : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
              local.class,
            )}
            {...others}
          >
            <div
              data-sidebar="sidebar"
              class="flex size-full flex-col overflow-hidden bg-sidebar/40 backdrop-blur-xl dark:bg-sidebar/25 group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow"
            >
              {local.children}
            </div>
          </div>
        </div>
      </Match>
    </Switch>
  );
};

type SidebarTriggerProps<T extends ValidComponent = "button"> =
  ButtonProps<T> & {
    onClick?: (event: MouseEvent) => void;
  };

const SidebarTrigger = <T extends ValidComponent = "button">(
  props: SidebarTriggerProps<T>,
) => {
  const [local, others] = splitProps(props as SidebarTriggerProps, [
    "class",
    "onClick",
  ]);
  const { toggleSidebar } = useSidebar();
  const { t } = useI18n();

  return (
    <Button
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      class={cn("size-7", local.class)}
      onClick={(event: MouseEvent) => {
        local.onClick?.(event);
        toggleSidebar();
      }}
      {...others}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
      </svg>
      <span class="sr-only">{t("nav.toggleSidebar")}</span>
    </Button>
  );
};

const SidebarInset: Component<ComponentProps<"main">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <main
      class={cn(
        "relative flex min-h-svh flex-1 flex-col bg-background",
        "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        local.class,
      )}
      {...others}
    />
  );
};

const SidebarHeader: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-sidebar="header"
      class={cn("flex flex-col gap-2 p-2", local.class)}
      {...others}
    />
  );
};

const SidebarFooter: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-sidebar="footer"
      class={cn("flex flex-col gap-2 p-2", local.class)}
      {...others}
    />
  );
};

const SidebarContent: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-sidebar="content"
      class={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        local.class,
      )}
      {...others}
    />
  );
};

const SidebarGroup: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-sidebar="group"
      class={cn("relative flex w-full min-w-0 flex-col p-2", local.class)}
      {...others}
    />
  );
};

type SidebarGroupLabelProps<T extends ValidComponent = "div"> =
  ComponentProps<T>;

const SidebarGroupLabel = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SidebarGroupLabelProps<T>>,
) => {
  const [local, others] = splitProps(props as SidebarGroupLabelProps, [
    "class",
  ]);

  return (
    <Polymorphic<SidebarGroupLabelProps>
      as="div"
      data-sidebar="group-label"
      class={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        local.class,
      )}
      {...others}
    />
  );
};

const SidebarGroupContent: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-sidebar="group-content"
      class={cn("w-full text-sm", local.class)}
      {...others}
    />
  );
};

const SidebarMenu: Component<ComponentProps<"ul">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <ul
      data-sidebar="menu"
      class={cn("flex w-full min-w-0 flex-col gap-1", local.class)}
      {...others}
    />
  );
};

const SidebarMenuItem: Component<ComponentProps<"li">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <li
      data-sidebar="menu-item"
      class={cn("group/menu-item relative", local.class)}
      {...others}
    />
  );
};

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type SidebarMenuButtonProps<T extends ValidComponent = "button"> =
  ComponentProps<T> &
    VariantProps<typeof sidebarMenuButtonVariants> & {
      isActive?: boolean;
    };

const SidebarMenuButton = <T extends ValidComponent = "button">(
  rawProps: PolymorphicProps<T, SidebarMenuButtonProps<T>>,
) => {
  const props = mergeProps(
    { isActive: false, variant: "default", size: "default" },
    rawProps,
  );
  const [local, others] = splitProps(props as SidebarMenuButtonProps, [
    "isActive",
    "variant",
    "size",
    "class",
  ]);

  return (
    <Polymorphic<SidebarMenuButtonProps>
      as="button"
      data-sidebar="menu-button"
      data-size={local.size}
      data-active={local.isActive}
      class={cn(
        sidebarMenuButtonVariants({
          variant: local.variant,
          size: local.size,
        }),
        local.class,
      )}
      {...others}
    />
  );
};

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
};
