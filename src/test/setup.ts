import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock @tauri-apps/plugin-clipboard-manager
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve("")),
}));

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
  copyFile: vi.fn(() => Promise.resolve()),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

// Mock @tauri-apps/plugin-store
vi.mock("@tauri-apps/plugin-store", () => ({
  // biome-ignore lint/complexity/useArrowFunction: regular function required for `new` constructor mock
  LazyStore: vi.fn().mockImplementation(function () {
    return {
      get: vi.fn(),
      set: vi.fn(),
      save: vi.fn(),
    };
  }),
}));
