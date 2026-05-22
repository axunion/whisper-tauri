import type { JSX } from "solid-js";
import type { ToastAction } from "~/components/ui/toast";
import { showToast } from "~/components/ui/toast";

type ToastOptions = {
  description?: JSX.Element;
  duration?: number;
  actions?: ToastAction[];
};

function buildOptions(variant: "success" | "warning" | "error" | "info") {
  const defaults = {
    success: 3000,
    warning: 5000,
    error: 5000,
    info: 3000,
  } as const;
  return (message: string, options?: ToastOptions) =>
    showToast({
      title: message,
      variant,
      duration: options?.duration ?? defaults[variant],
      ...(options?.description !== undefined && {
        description: options.description,
      }),
      ...(options?.actions !== undefined && { actions: options.actions }),
    });
}

export const toast = {
  success: buildOptions("success"),
  warning: buildOptions("warning"),
  error: buildOptions("error"),
  info: buildOptions("info"),
};
