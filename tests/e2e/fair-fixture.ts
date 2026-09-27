import { test as base } from "@playwright/test";

// Keep legacy controls/course regressions on their original rules. Difficulty
// integration tests import Playwright directly and exercise the new default.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try { localStorage.setItem("loccao.fair.difficulty", "practice"); } catch {}
    });
    await use(page);
  },
});
