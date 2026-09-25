import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "tests/e2e",
  reporter: "list",
  use: {
    baseURL: `http://localhost:${String(port)}/music_grail/`,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}/music_grail/`,
    reuseExistingServer: !process.env.CI,
  },
});
