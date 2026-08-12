import type { DictionaryKey } from "~/i18n/types";
import { toast } from "~/lib/toast";
import type { AppError } from "~/types/errors";

interface RunWithToastOptions {
  /** Mutating primitive action that reports success as its return value. */
  action: () => Promise<boolean>;
  successKey: DictionaryKey;
  /** Error signal of the primitive that ran the action. */
  error: () => AppError | null;
  t: (key: DictionaryKey) => string;
}

/**
 * Runs a mutating primitive action and reports the outcome as a toast. Reading
 * the failure back from the primitive's own error signal keeps the toast in
 * step with the `ErrorDisplay` panel that the same primitive feeds, so a failed
 * action can no longer show a success toast next to a red error panel.
 */
export async function runWithToast(
  options: RunWithToastOptions,
): Promise<void> {
  const ok = await options.action();
  if (ok) {
    toast.success(options.t(options.successKey));
    return;
  }
  const err = options.error();
  if (err) toast.error(options.t(err.messageKey));
}
