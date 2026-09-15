import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests/game", workers: 1, reporter: "line" });
