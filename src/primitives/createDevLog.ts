import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { createSignal, onCleanup } from "solid-js";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface DevLogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let idCounter = 0;

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    .join(" ");
}

export function createDevLog() {
  const [logs, setLogs] = createSignal<DevLogEntry[]>([]);
  const [levelFilter, setLevelFilter] = createSignal<LogLevel | null>(null);

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  function addEntry(level: LogLevel, args: unknown[]) {
    const entry: DevLogEntry = {
      id: `log-${++idCounter}`,
      timestamp: new Date(),
      level,
      message: formatArgs(args),
    };
    setLogs((prev) => [...prev, entry]);
  }

  console.log = (...args: unknown[]) => {
    addEntry("DEBUG", args);
    originalLog(...args);
  };

  console.info = (...args: unknown[]) => {
    addEntry("INFO", args);
    originalInfo(...args);
  };

  console.warn = (...args: unknown[]) => {
    addEntry("WARN", args);
    originalWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    addEntry("ERROR", args);
    originalError(...args);
  };

  onCleanup(() => {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });

  function filteredLogs(): DevLogEntry[] {
    const filter = levelFilter();
    if (filter === null) return logs();
    const minRank = LEVEL_RANK[filter];
    return logs().filter((entry) => LEVEL_RANK[entry.level] >= minRank);
  }

  function clear() {
    setLogs([]);
  }

  async function copyAll(): Promise<void> {
    const text = filteredLogs()
      .map((entry) => {
        const ts = entry.timestamp.toISOString();
        return `[${ts}] [${entry.level}] ${entry.message}`;
      })
      .join("\n");
    await writeText(text);
  }

  return {
    logs,
    levelFilter,
    setLevelFilter,
    filteredLogs,
    clear,
    copyAll,
  };
}
