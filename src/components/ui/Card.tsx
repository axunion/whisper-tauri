import type { Component, ComponentProps, JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/utils";

const Card: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "rounded-lg border border-border/30 bg-card/45 text-card-foreground shadow-sm backdrop-blur-lg dark:bg-card/25",
        local.class,
      )}
      {...others}
    />
  );
};

const CardHeader: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex flex-col space-y-1.5 p-6", local.class)} {...others} />
  );
};

const CardTitle: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "text-lg font-semibold leading-none tracking-tight",
        local.class,
      )}
      {...others}
    />
  );
};

const CardDescription: Component<ComponentProps<"p">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <p class={cn("text-sm text-muted-foreground", local.class)} {...others} />
  );
};

const CardContent: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return <div class={cn("p-6 pt-0", local.class)} {...others} />;
};

const CardFooter: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex items-center p-6 pt-0", local.class)} {...others} />
  );
};

/**
 * A fully clickable Card: keyboard-focusable button filling the card, with the
 * hover state on the Card and the focus ring hugging the Card's rounded-lg.
 */
const CardButton: Component<ComponentProps<"button">> = (props) => {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <Card class="transition-colors hover:bg-muted/50">
      <button
        type="button"
        class={cn(
          "w-full cursor-pointer rounded-lg ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          local.class,
        )}
        {...others}
      >
        {local.children}
      </button>
    </Card>
  );
};

const CardTitleWithIcon: Component<
  ComponentProps<"div"> & {
    icon: () => JSX.Element;
    trailing?: JSX.Element;
  }
> = (props) => {
  const [local, others] = splitProps(props, ["icon", "trailing", "children"]);
  return (
    <CardTitle class="flex items-center gap-3" {...others}>
      <span class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {local.icon()}
      </span>
      <span class="flex items-center gap-2">
        {local.children}
        {local.trailing}
      </span>
    </CardTitle>
  );
};

export {
  Card,
  CardButton,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardTitleWithIcon,
};
