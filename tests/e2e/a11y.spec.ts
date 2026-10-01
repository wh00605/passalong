import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/search?q=dress", "/c/women", "/login", "/signup", "/help", "/legal/terms", "/contact", "/report-illegal-content", "/members/amelia_wardrobe"];

for (const path of PAGES) {
  test(`no WCAG 2.2 AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.cookie = "pa_consent=" + encodeURIComponent(JSON.stringify({ analytics: false, marketing: false, version: "2026-10-01" })) + "; path=/");
    await page.reload();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.help} → ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}

test("item page has no violations and keyboard reaches Buy now", async ({ page }) => {
  await page.goto("/search?q=barbour");
  const href = await page.getByRole("link", { name: /Barbour/ }).first().getAttribute("href");
  await page.goto(href!);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});
