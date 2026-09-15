import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "html",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    channel: process.env.E2E_GL_BACKEND === "d3d11" ? "chromium" : undefined,
    launchOptions: ["d3d11", "swiftshader"].includes(process.env.E2E_GL_BACKEND || "")
      ? { args: ["--use-gl=angle", `--use-angle=${process.env.E2E_GL_BACKEND}`] } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
