import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Whisper Tauri",
  description:
    "A privacy-first desktop app for local audio transcription. All inference runs on-device.",
  base: "/whisper-tauri/",
  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Install", link: "/install" },
      { text: "FAQ", link: "/faq" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Installation", link: "/install" },
          { text: "FAQ", link: "/faq" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Privacy", link: "/privacy" },
          { text: "Licenses", link: "/licenses" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/axunion/whisper-tauri" },
    ],
    outline: { level: [2, 3] },
  },
});
