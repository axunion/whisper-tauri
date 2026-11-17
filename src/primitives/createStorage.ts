import { createSignal } from "solid-js";
import { commands } from "~/bindings";
import { parseError } from "~/lib/errors";
import { createRecording } from "~/primitives/createRecording";
import type { StorageStats } from "~/types";
import type { AppError } from "~/types/errors";

/** Disk usage of recording audio, and the bulk deletes that reclaim it. */
export function createStorage() {
  const [stats, setStats] = createSignal<StorageStats | null>(null);
  const [error, setError] = createSignal<AppError | null>(null);

  async function load(): Promise<void> {
    try {
      // The recording this session still holds is on screen in the record
      // tab, not a leftover: it is neither counted here nor deleted below.
      setStats(
        await commands.historyStorageStats(createRecording().tempFilePath()),
      );
    } catch (e) {
      setError(parseError(e));
    }
  }

  /** Runs a delete command, then refreshes the usage it changed. */
  async function runDelete(command: () => Promise<unknown>): Promise<boolean> {
    try {
      await command();
      await load();
      return true;
    } catch (e) {
      setError(parseError(e));
      return false;
    }
  }

  /** Deletes the audio of every history entry, keeping the entries. */
  function deleteAllAudio(): Promise<boolean> {
    return runDelete(commands.historyDeleteAllAudio);
  }

  /** Deletes every history entry together with its audio. */
  function deleteAllHistory(): Promise<boolean> {
    return runDelete(commands.historyDeleteAll);
  }

  /** Deletes recordings that were never transcribed. */
  function deletePendingRecordings(): Promise<boolean> {
    return runDelete(() =>
      commands.historyDeletePendingRecordings(createRecording().tempFilePath()),
    );
  }

  function clearError(): void {
    setError(null);
  }

  return {
    stats,
    error,
    load,
    deleteAllAudio,
    deleteAllHistory,
    deletePendingRecordings,
    clearError,
  };
}
