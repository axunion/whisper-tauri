import { invoke as coreInvoke } from "@tauri-apps/api/core";

/**
 * Stands in for `invoke` inside the generated bindings under test (see the
 * alias in `vitest.config.ts`). The bindings always pass `args` and `options`,
 * even when undefined; dropping the trailing ones lets tests assert on the
 * call the way the wire sees it: `invoke("command")` or `invoke("command", args)`.
 */
export function invoke(...call: unknown[]): unknown {
  while (call.length > 1 && call[call.length - 1] === undefined) call.pop();
  return (coreInvoke as (...args: unknown[]) => unknown)(...call);
}
