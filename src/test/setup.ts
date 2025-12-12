import { vi } from "vitest";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Mock @tauri-apps/plugin-fs
vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

// Mock @tauri-apps/plugin-store
vi.mock("@tauri-apps/plugin-store", () => ({
  Store: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    save: vi.fn(),
    load: vi.fn(),
  })),
}));
