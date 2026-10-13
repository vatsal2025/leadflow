import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const python =
  process.env.PYTHON ||
  path.resolve(
    "..",
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: `"${python}" ../scripts/e2e_api.py`,
      url: "http://127.0.0.1:8000/api/health/ready",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "npm run start",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
