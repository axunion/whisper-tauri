import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock @tauri-apps/plugin-clipboard-manager
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve("")),
}));

// Mock @tauri-apps/api/app
vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(() => Promise.resolve("0.1.0")),
}));

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

// Mock @tauri-apps/api/event
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));

// Mock @tauri-apps/api/window
vi.mock("@tauri-apps/api/window", () => {
  const currentWindow = {
    show: vi.fn(() => Promise.resolve()),
    isFocused: vi.fn(() => Promise.resolve(true)),
    center: vi.fn(() => Promise.resolve()),
    setSize: vi.fn(() => Promise.resolve()),
    setMinSize: vi.fn(() => Promise.resolve()),
    onCloseRequested: vi.fn(() => Promise.resolve(() => {})),
  };
  return {
    getCurrentWindow: () => currentWindow,
    // biome-ignore lint/complexity/useArrowFunction: regular function required for `new` constructor mock
    LogicalSize: vi.fn().mockImplementation(function () {
      return {};
    }),
  };
});

// Mock @tauri-apps/plugin-notification
vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: vi.fn(),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
  confirm: vi.fn(),
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
