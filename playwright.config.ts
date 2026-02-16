import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:1422",
    headless: true,
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 1422",
    url: "http://127.0.0.1:1422",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
