import * as CheckboxPrimitive from "@kobalte/core/checkbox";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/utils";

const checkboxControlVariants = cva(
  [
    "size-4 shrink-0 rounded-sm border ring-offset-background",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      colorScheme: {
        primary:
          "border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground",
        neutral:
          "border-foreground/40 data-[checked]:bg-foreground data-[checked]:text-background",
      },
    },
    defaultVariants: {
      colorScheme: "primary",
    },
  },
);

type CheckboxRootProps<T extends ValidComponent = "div"> =
  CheckboxPrimitive.CheckboxRootProps<T> &
    VariantProps<typeof checkboxControlVariants> & {
      class?: string | undefined;
    };

const Checkbox = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, CheckboxRootProps<T>>,
) => {
  const [local, others] = splitProps(props as CheckboxRootProps, [
    "class",
    "colorScheme",
  ]);
  return (
    <CheckboxPrimitive.Root
      class={cn("items-top flex space-x-2", local.class)}
      {...others}
    >
      <CheckboxPrimitive.Input class="peer" />
      <CheckboxPrimitive.Control
        class={checkboxControlVariants({ colorScheme: local.colorScheme })}
      >
        <CheckboxPrimitive.Indicator class="flex items-center justify-center text-current">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-3.5"
            aria-hidden="true"
          >
            <title>Check</title>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Control>
    </CheckboxPrimitive.Root>
  );
};

export { Checkbox };
export type { CheckboxRootProps };
