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

const CardTitleWithIcon: Component<
  ComponentProps<"div"> & { icon: () => JSX.Element }
> = (props) => {
  const [local, others] = splitProps(props, ["icon", "children"]);
  return (
    <CardTitle class="flex items-center gap-3" {...others}>
      <span class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {local.icon()}
      </span>
      {local.children}
    </CardTitle>
  );
};

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardTitleWithIcon,
  CardDescription,
  CardContent,
};
