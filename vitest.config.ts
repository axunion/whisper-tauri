import path from "node:path";
import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [
    solid(),
    {
      name: "bindings-invoke",
      enforce: "pre",
      resolveId(source, importer) {
        if (
          source === "@tauri-apps/api/core" &&
          importer?.endsWith("/src/bindings.ts")
        ) {
          return path.resolve(__dirname, "./src/test/bindingsInvoke.ts");
        }
        return null;
      },
    },
  ],
  test: {
    environment: "jsdom",
    globals: true,
    // Vitest 5 clears mock call history before each test by default; tests here
    // assert on calls made at module load (e.g. `listen` registrations).
    clearMocks: false,
    // Pinned so the timezone assertions in `format.test.ts` stay meaningful:
    // under UTC, misreading a stored UTC timestamp as local time is a no-op and
    // the regression would pass unnoticed.
    env: { TZ: "Asia/Tokyo" },
    setupFiles: ["./src/test/setup.ts"],
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
