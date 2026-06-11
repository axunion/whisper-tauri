import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUpdateCheck } from "../createUpdateCheck";

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createUpdateCheck", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(getVersion).mockReset();
    vi.mocked(getVersion).mockResolvedValue("0.1.0");
  });

  describe("initial state", () => {
    it("should start in idle state", () => {
      createRoot((dispose) => {
        const updateCheck = createUpdateCheck();
        expect(updateCheck.status()).toEqual({ state: "idle" });
        dispose();
      });
    });

    it("should load the current version", async () => {
      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();
        await flushPromises();
        expect(updateCheck.currentVersion()).toBe("0.1.0");
        dispose();
      });
    });
  });

  describe("check", () => {
    it("should report latest when versions match", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("v0.1.0");

      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();
        await updateCheck.check();

        expect(invoke).toHaveBeenCalledWith("check_latest_version");
        expect(updateCheck.status()).toEqual({ state: "latest" });
        dispose();
      });
    });

    it("should report latest when current is newer than the release", async () => {
      vi.mocked(getVersion).mockResolvedValue("0.2.0");
      vi.mocked(invoke).mockResolvedValueOnce("v0.1.0");

      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();
        await updateCheck.check();

        expect(updateCheck.status()).toEqual({ state: "latest" });
        dispose();
      });
    });

    it("should report available with the new version tag", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("v0.2.0");

      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();
        await updateCheck.check();

        expect(updateCheck.status()).toEqual({
          state: "available",
          version: "v0.2.0",
        });
        dispose();
      });
    });

    it("should set checking state while in flight", async () => {
      let resolveCheck: (value: string) => void = () => {};
      const checkPromise = new Promise<string>((resolve) => {
        resolveCheck = resolve;
      });
      vi.mocked(invoke).mockReturnValueOnce(checkPromise as Promise<unknown>);

      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();

        const promise = updateCheck.check();
        expect(updateCheck.status()).toEqual({ state: "checking" });

        resolveCheck("v0.1.0");
        await promise;

        expect(updateCheck.status()).toEqual({ state: "latest" });
        dispose();
      });
    });

    it("should set error state on failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce("HTTP error: status 404");

      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();
        await updateCheck.check();

        expect(updateCheck.status()).toEqual({ state: "error" });
        dispose();
      });
    });

    it("should allow re-checking after an error", async () => {
      vi.mocked(invoke)
        .mockRejectedValueOnce("HTTP error: status 404")
        .mockResolvedValueOnce("v0.1.0");

      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();
        await updateCheck.check();
        expect(updateCheck.status()).toEqual({ state: "error" });

        await updateCheck.check();
        expect(updateCheck.status()).toEqual({ state: "latest" });
        dispose();
      });
    });

    it("should reuse the loaded current version instead of re-fetching", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("v0.1.0");

      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();
        await flushPromises(); // let the creation-time getVersion() resolve

        await updateCheck.check();

        expect(vi.mocked(getVersion).mock.calls.length).toBe(1);
        expect(updateCheck.status()).toEqual({ state: "latest" });
        dispose();
      });
    });

    it("should fall back to fetching the version when not yet loaded", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("v0.2.0");

      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();
        // check() immediately, before the creation-time getVersion() resolves
        await updateCheck.check();

        expect(updateCheck.status()).toEqual({
          state: "available",
          version: "v0.2.0",
        });
        expect(updateCheck.currentVersion()).toBe("0.1.0");
        dispose();
      });
    });

    it("should not start a second check while one is in flight", async () => {
      let resolveCheck: (value: string) => void = () => {};
      const checkPromise = new Promise<string>((resolve) => {
        resolveCheck = resolve;
      });
      vi.mocked(invoke).mockReturnValueOnce(checkPromise as Promise<unknown>);

      await createRoot(async (dispose) => {
        const updateCheck = createUpdateCheck();

        const promise = updateCheck.check();
        updateCheck.check(); // Should be ignored

        await flushPromises(); // let the first check reach invoke
        expect(vi.mocked(invoke).mock.calls.length).toBe(1);

        resolveCheck("v0.1.0");
        await promise;
        dispose();
      });
    });
  });
});
