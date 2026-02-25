import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { DevLogEntry } from "../createDevLog";
import { createDevLog } from "../createDevLog";

describe("createDevLog", () => {
  describe("initial state", () => {
    it("should have empty logs", () => {
      createRoot((dispose) => {
        const devLog = createDevLog();
        expect(devLog.logs()).toEqual([]);
        dispose();
      });
    });

    it("should have null levelFilter", () => {
      createRoot((dispose) => {
        const devLog = createDevLog();
        expect(devLog.levelFilter()).toBeNull();
        dispose();
      });
    });
  });

  describe("console capture", () => {
    it("should capture console.log as DEBUG", () => {
      createRoot((dispose) => {
        const devLog = createDevLog();
        console.log("test debug message");

        const logs = devLog.logs();
        expect(logs).toHaveLength(1);
        expect(logs[0]?.level).toBe("DEBUG");
        expect(logs[0]?.message).toBe("test debug message");
        dispose();
      });
    });

    it("should capture console.info as INFO", () => {
      createRoot((dispose) => {
        const devLog = createDevLog();
        console.info("test info message");

        const logs = devLog.logs();
        expect(logs).toHaveLength(1);
        expect(logs[0]?.level).toBe("INFO");
        expect(logs[0]?.message).toBe("test info message");
        dispose();
      });
    });

    it("should capture console.warn as WARN", () => {
      createRoot((dispose) => {
        const devLog = createDevLog();
        console.warn("test warn message");

        const logs = devLog.logs();
        expect(logs).toHaveLength(1);
        expect(logs[0]?.level).toBe("WARN");
        expect(logs[0]?.message).toBe("test warn message");
        dispose();
      });
    });

    it("should capture console.error as ERROR", () => {
      createRoot((dispose) => {
        const devLog = createDevLog();
        console.error("test error message");

        const logs = devLog.logs();
        expect(logs).toHaveLength(1);
        expect(logs[0]?.level).toBe("ERROR");
        expect(logs[0]?.message).toBe("test error message");
        dispose();
      });
    });

    it("should pass through to original console methods", () => {
      const originalLog = console.log;
      const spy = vi.fn();
      console.log = spy;

      createRoot((dispose) => {
        // createDevLog replaces console.log with a wrapper that calls `spy` (the "original")
        createDevLog();
        console.log("passthrough test");

        expect(spy).toHaveBeenCalledWith("passthrough test");
        dispose();
      });

      console.log = originalLog;
    });

    it("should include id and timestamp in entries", () => {
      createRoot((dispose) => {
        const devLog = createDevLog();
        console.log("entry test");

        const entry = devLog.logs()[0];
        expect(entry?.id).toBeDefined();
        expect(entry?.timestamp).toBeInstanceOf(Date);
        dispose();
      });
    });

    it("should stringify non-string arguments", () => {
      createRoot((dispose) => {
        const devLog = createDevLog();
        console.log("count:", 42, { key: "value" });

        const entry = devLog.logs()[0];
        expect(entry?.message).toBe('count: 42 {"key":"value"}');
        dispose();
      });
    });
  });

  describe("filteredLogs", () => {
    function setupLogs() {
      return createRoot((dispose) => {
        const devLog = createDevLog();
        console.log("debug msg");
        console.info("info msg");
        console.warn("warn msg");
        console.error("error msg");
        return { devLog, dispose };
      });
    }

    it("should return all logs when filter is null", () => {
      const { devLog, dispose } = setupLogs();
      expect(devLog.filteredLogs()).toHaveLength(4);
      dispose();
    });

    it("should filter DEBUG and above when filter is DEBUG", () => {
      const { devLog, dispose } = setupLogs();
      devLog.setLevelFilter("DEBUG");
      expect(devLog.filteredLogs()).toHaveLength(4);
      dispose();
    });

    it("should filter INFO and above when filter is INFO", () => {
      const { devLog, dispose } = setupLogs();
      devLog.setLevelFilter("INFO");
      const filtered = devLog.filteredLogs();
      expect(filtered).toHaveLength(3);
      expect(filtered.map((l: DevLogEntry) => l.level)).toEqual([
        "INFO",
        "WARN",
        "ERROR",
      ]);
      dispose();
    });

    it("should filter WARN and above when filter is WARN", () => {
      const { devLog, dispose } = setupLogs();
      devLog.setLevelFilter("WARN");
      const filtered = devLog.filteredLogs();
      expect(filtered).toHaveLength(2);
      expect(filtered.map((l: DevLogEntry) => l.level)).toEqual([
        "WARN",
        "ERROR",
      ]);
      dispose();
    });

    it("should filter ERROR only when filter is ERROR", () => {
      const { devLog, dispose } = setupLogs();
      devLog.setLevelFilter("ERROR");
      const filtered = devLog.filteredLogs();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.level).toBe("ERROR");
      dispose();
    });
  });

  describe("clear", () => {
    it("should clear all logs", () => {
      createRoot((dispose) => {
        const devLog = createDevLog();
        console.log("msg1");
        console.log("msg2");
        expect(devLog.logs()).toHaveLength(2);

        devLog.clear();
        expect(devLog.logs()).toEqual([]);
        dispose();
      });
    });
  });

  describe("copyAll", () => {
    it("should call writeText with formatted logs", async () => {
      await createRoot(async (dispose) => {
        const devLog = createDevLog();
        console.log("copy test");

        await devLog.copyAll();

        expect(writeText).toHaveBeenCalledTimes(1);
        const calledWith = vi.mocked(writeText).mock.calls[0]?.[0] as string;
        expect(calledWith).toContain("[DEBUG] copy test");
        dispose();
      });
    });
  });

  describe("dispose", () => {
    it("should restore original console methods on dispose", () => {
      const originalLog = console.log;
      const originalInfo = console.info;
      const originalWarn = console.warn;
      const originalError = console.error;

      createRoot((dispose) => {
        createDevLog();
        // console methods are now wrapped
        expect(console.log).not.toBe(originalLog);
        dispose();
      });

      // After dispose, originals should be restored
      expect(console.log).toBe(originalLog);
      expect(console.info).toBe(originalInfo);
      expect(console.warn).toBe(originalWarn);
      expect(console.error).toBe(originalError);
    });
  });
});
