import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import type { NotionPagePayload, NotionPageRef } from "~/types";

export type NotionShareState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; pageRef: NotionPageRef }
  | { kind: "error"; message: string };

export function createNotionShare() {
  const [state, setState] = createSignal<NotionShareState>({ kind: "idle" });

  async function share(payload: NotionPagePayload): Promise<void> {
    setState({ kind: "sending" });
    try {
      const pageRef = await invoke<NotionPageRef>("notion_create_page", {
        payload,
      });
      setState({ kind: "success", pageRef });
    } catch (e) {
      setState({
        kind: "error",
        message: parseError(e).details ?? "Unknown error",
      });
    }
  }

  function reset(): void {
    setState({ kind: "idle" });
  }

  return { state, share, reset };
}
