import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import type { DictionaryKey } from "~/i18n/types";
import { parseError } from "~/lib/errors";
import type { NotionPagePayload, NotionPageRef } from "~/types";

export type NotionShareState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; messageKey: DictionaryKey; details?: string };

export function createNotionShare() {
  const [state, setState] = createSignal<NotionShareState>({ kind: "idle" });

  async function share(
    payload: NotionPagePayload,
  ): Promise<NotionPageRef | null> {
    setState({ kind: "sending" });
    try {
      const pageRef = await invoke<NotionPageRef>("notion_create_page", {
        payload,
      });
      setState({ kind: "idle" });
      return pageRef;
    } catch (e) {
      const err = parseError(e);
      setState({
        kind: "error",
        messageKey: err.messageKey,
        ...(err.details ? { details: err.details } : {}),
      });
      return null;
    }
  }

  function reset(): void {
    setState({ kind: "idle" });
  }

  return { state, share, reset };
}
