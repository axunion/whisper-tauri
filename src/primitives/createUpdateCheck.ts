import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { type Accessor, createSignal } from "solid-js";
import { isNewerVersion } from "~/lib/version";

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "latest" }
  | { state: "available"; version: string }
  | { state: "error" };

export interface UpdateCheck {
  status: Accessor<UpdateStatus>;
  currentVersion: Accessor<string>;
  check: () => Promise<void>;
}

export function createUpdateCheck(): UpdateCheck {
  const [status, setStatus] = createSignal<UpdateStatus>({ state: "idle" });
  const [currentVersion, setCurrentVersion] = createSignal("");

  void getVersion()
    .then(setCurrentVersion)
    .catch((err) => console.error("Failed to get app version:", err));

  async function check(): Promise<void> {
    if (status().state === "checking") return;
    setStatus({ state: "checking" });
    try {
      // The app version is immutable at runtime — reuse the loaded value
      let current = currentVersion();
      if (!current) {
        current = await getVersion();
        setCurrentVersion(current);
      }
      const latest = await invoke<string>("check_latest_version");
      setStatus(
        isNewerVersion(current, latest)
          ? { state: "available", version: latest }
          : { state: "latest" },
      );
    } catch (err) {
      console.error("Update check failed:", err);
      setStatus({ state: "error" });
    }
  }

  return { status, currentVersion, check };
}
