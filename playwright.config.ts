import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:8080",
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: process.env.E2E_SERVER
    ? undefined
    : {
        command: "npm run build && npm start",
        url: "http://127.0.0.1:8080/health",
        reuseExistingServer: true,
        timeout: 60000,
      },
});
