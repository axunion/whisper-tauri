import path from "node:path";
import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  test: {
    environment: "jsdom",
    globals: true,
    // Pinned so the timezone assertions in `format.test.ts` stay meaningful:
    // under UTC, misreading a stored UTC timestamp as local time is a no-op and
    // the regression would pass unnoticed.
    env: { TZ: "Asia/Tokyo" },
    setupFiles: ["./src/test/setup.ts"],
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
    deps: {
      optimizer: {
        web: {
          include: [
            "solid-js",
            "@solidjs/router",
            "@kobalte/core",
            "@kobalte/utils",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
          ],
        },
      },
    },
    server: {
      deps: {
        inline: [/@kobalte/, /@corvu/, /@solidjs\/router/, /solid-icons/, /solid-presence/, /solid-prevent-scroll/],
      },
    },
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
