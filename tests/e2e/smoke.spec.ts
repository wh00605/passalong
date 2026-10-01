import { expect, test } from "@playwright/test";
import { acceptCookieChoice, logIn } from "./helpers";

const PAGES = ["/", "/search?q=jacket", "/c/men", "/members/amelia_wardrobe", "/help", "/sell", "/inbox", "/orders", "/wallet", "/settings/profile"];

async function noHorizontalScroll(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, `${path} overflows horizontally`).toBeLessThanOrEqual(client);
}

test("no horizontal scrolling when signed out", async ({ page }) => {
  await acceptCookieChoice(page);
  for (const p of PAGES.slice(0, 5)) await noHorizontalScroll(page, p);
});

test("no horizontal scrolling when signed in", async ({ page }) => {
  await logIn(page, "amelia@passalong.test");
  for (const p of PAGES) await noHorizontalScroll(page, p);
});
