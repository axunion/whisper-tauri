import * as DialogPrimitive from "@kobalte/core/dialog";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.CloseButton;
const SheetPortal = DialogPrimitive.Portal;

type SheetOverlayProps<T extends ValidComponent = "div"> =
  DialogPrimitive.DialogOverlayProps<T> & {
    class?: string | undefined;
  };

const SheetOverlay = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SheetOverlayProps<T>>,
) => {
  const [local, others] = splitProps(props as SheetOverlayProps, ["class"]);
  return (
    <DialogPrimitive.Overlay
      class={cn(
        "fixed inset-0 z-50 bg-background/60 backdrop-blur-md duration-300 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0",
        local.class,
      )}
      {...others}
    />
  );
};

type SheetContentProps<T extends ValidComponent = "div"> =
  DialogPrimitive.DialogContentProps<T> & {
    class?: string | undefined;
    children?: JSX.Element;
  };

const SheetContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SheetContentProps<T>>,
) => {
  const [local, others] = splitProps(props as SheetContentProps, [
    "class",
    "children",
  ]);
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        class={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-3/4 max-w-lg flex-col gap-4 border-l bg-card/55 backdrop-blur-xl dark:bg-card/35 p-6 shadow-lg duration-300 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:slide-out-to-right data-[expanded]:slide-in-from-right sm:max-w-xl",
          local.class,
        )}
        {...others}
      >
        {local.children}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
};

type SheetHeaderProps = {
  class?: string | undefined;
  children?: JSX.Element;
};

const SheetHeader = (props: SheetHeaderProps) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      class={cn("flex flex-col space-y-2 text-left", local.class)}
      {...others}
    />
  );
};

type SheetTitleProps<T extends ValidComponent = "h2"> =
  DialogPrimitive.DialogTitleProps<T> & {
    class?: string | undefined;
  };

const SheetTitle = <T extends ValidComponent = "h2">(
  props: PolymorphicProps<T, SheetTitleProps<T>>,
) => {
  const [local, others] = splitProps(props as SheetTitleProps, ["class"]);
  return (
    <DialogPrimitive.Title
      class={cn("text-lg font-semibold text-foreground", local.class)}
      {...others}
    />
  );
};

type SheetDescriptionProps<T extends ValidComponent = "p"> =
  DialogPrimitive.DialogDescriptionProps<T> & {
    class?: string | undefined;
  };

const SheetDescription = <T extends ValidComponent = "p">(
  props: PolymorphicProps<T, SheetDescriptionProps<T>>,
) => {
  const [local, others] = splitProps(props as SheetDescriptionProps, ["class"]);
  return (
    <DialogPrimitive.Description
      class={cn("text-sm text-muted-foreground", local.class)}
      {...others}
    />
  );
};

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
