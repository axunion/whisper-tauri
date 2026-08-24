// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";

// https://astro.build/config
export default defineConfig({
  site: "https://axunion.github.io",
  base: "/whisper-tauri",
  integrations: [
    starlight({
      title: "Whisper Tauri",
      description:
        "A privacy-first desktop app for local audio transcription. All inference runs on-device.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/axunion/whisper-tauri",
        },
      ],
      sidebar: [
        {
          label: "Guide",
          items: [
            { label: "Getting Started", slug: "getting-started" },
            { label: "Installation", slug: "install" },
            { label: "FAQ", slug: "faq" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Privacy", slug: "privacy" },
            { label: "Licenses", slug: "licenses" },
          ],
        },
      ],
      plugins: [starlightLinksValidator()],
    }),
  ],
});
