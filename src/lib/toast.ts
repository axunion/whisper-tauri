import { showToast } from "~/components/ui/toast";

export const toast = {
  success: (message: string) =>
    showToast({ title: message, variant: "success", duration: 3000 }),
  error: (message: string) =>
    showToast({ title: message, variant: "error", duration: 5000 }),
  info: (message: string) =>
    showToast({ title: message, variant: "info", duration: 3000 }),
};
