import { test, expect } from "@playwright/test";
import { missionConfigs } from "../../data/missionConfigs";

for (const height of [551, 844]) {
  test(`all mission titles and progress fit at 390×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height });
    for (const [scenario, config] of Object.entries(missionConfigs)) {
      await page.goto(`/missions/${scenario}`);
      const title = page.getByRole("heading", { name: config.title, exact: true });
      await expect(title).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.locator(".mission-header").evaluate(header => {
        const h1 = header.querySelector("h1")!;
        const progress = header.querySelector(".mission-progress")!;
        const frame = header.getBoundingClientRect();
        const heading = h1.getBoundingClientRect();
        const badge = progress.getBoundingClientRect();
        // Page scroll alone misses text clipped by the hero's overflow:hidden.
        const text = document.createRange();
        text.selectNodeContents(h1);
        const lines = Array.from(text.getClientRects());
        return {
          titleFits: h1.scrollWidth <= h1.clientWidth + 1 && lines.every(line =>
            line.left >= frame.left && line.right <= frame.right + 1 && line.bottom <= frame.bottom),
          badgeFits: badge.left >= frame.left && badge.right <= frame.right + 1 && badge.bottom <= frame.bottom,
          separate: badge.top >= heading.bottom || badge.left >= heading.right,
          badgeWidth: badge.width,
          pageFits: document.documentElement.scrollWidth <= innerWidth,
        };
      });
      expect(geometry, scenario).toMatchObject({ titleFits: true, badgeFits: true, separate: true, pageFits: true });
      expect(geometry.badgeWidth, scenario).toBeGreaterThanOrEqual(72);
      if (scenario === "misunderstanding") {
        await page.screenshot({ path: `.cache/mission-mobile-title-${height}.png`, fullPage: true });
      }
    }
  });
}
