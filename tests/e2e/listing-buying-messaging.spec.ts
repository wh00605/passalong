import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { logIn, logOut } from "./helpers";

async function testPhoto() {
  return sharp({ create: { width: 800, height: 1000, channels: 3, background: { r: 200, g: 80, b: 120 } } }).jpeg().toBuffer();
}

test("seller lists an item; buyer messages, makes an offer and reaches checkout", async ({ page }) => {
  const title = `E2E denim jacket ${Date.now().toString(36)}`;

  // ── Seller lists an item ──
  await logIn(page, "olliebrooks@passalong.test".replace("olliebrooks", "ollie"));
  await page.goto("/sell");
  await page.locator('input[type="file"]').setInputFiles({ name: "jacket.jpg", mimeType: "image/jpeg", buffer: await testPhoto() });
  await expect(page.getByRole("img", { name: /Photo 1 \(cover\)/ })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("Classic mid-wash denim jacket, barely worn. No marks.");
  await page.getByLabel("Department", { exact: true }).selectOption({ label: "Men" });
  await page.getByLabel("Category level 2", { exact: true }).selectOption({ label: "Clothing" });
  await page.getByLabel("Category level 3", { exact: true }).selectOption({ label: "Coats & jackets" });
  await page.getByLabel("Size", { exact: true }).selectOption({ label: "M" });
  await page.getByText("Very good", { exact: true }).click();
  await page.getByLabel("Price", { exact: true }).fill("30");
  await expect(page.getByText(/You receive £30.00/)).toBeVisible();
  await page.getByText("Medium", { exact: true }).click();
  await page.getByRole("button", { name: "Publish item" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("£32.25").first()).toBeVisible(); // £30 + £0.75 + 5%
  const itemUrl = page.url();
  await logOut(page);

  // ── Buyer finds it via search and messages ──
  await logIn(page, "priya@passalong.test");
  await page.goto(`/search?q=${encodeURIComponent(title)}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  await page.goto(itemUrl);
  await page.getByRole("link", { name: "Message seller" }).click();
  await page.getByLabel("Message", { exact: true }).fill("Hi! Does it fit true to size?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Hi! Does it fit true to size?")).toBeVisible();

  // ── Offer below the minimum is rejected, valid offer is sent ──
  await page.getByRole("button", { name: "Offer" }).click();
  await page.getByLabel("Your offer").fill("10");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/at least £18.00/)).toBeVisible();
  await page.getByLabel("Your offer").fill("25");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("£25.00").first()).toBeVisible();
  await logOut(page);

  // ── Seller sees the message and accepts ──
  await logIn(page, "ollie@passalong.test");
  await page.goto("/inbox");
  await page.getByRole("link", { name: /Priya Shah/ }).first().click();
  await expect(page.getByText("Hi! Does it fit true to size?")).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("list", { name: "Messages" }).getByText(/accepted the offer/)).toBeVisible();
  await logOut(page);

  // ── Buyer checks out at the offer price ──
  await logIn(page, "priya@passalong.test");
  await page.goto("/inbox");
  await page.getByRole("link", { name: /Ollie Brooks/ }).first().click();
  await page.getByRole("link", { name: /Buy for £25.00/ }).first().click();
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  // £25 + medium postage £4.49 + BP (£0.75 + £1.25) = £31.49
  await expect(page.getByText("£31.49").first()).toBeVisible();
  await page.getByText("Meet in person").click();
  await expect(page.getByText("£27.00").first()).toBeVisible();

  if (process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    // With Stripe test keys configured, pay with Stripe's test card.
    const frame = page.frameLocator('iframe[title*="Secure payment"]').first();
    await frame.getByLabel("Card number").fill("4242424242424242");
    await frame.getByLabel("Expiration date").fill("12 / 34");
    await frame.getByLabel("Security code").fill("123");
    await page.getByRole("button", { name: /^Pay/ }).click();
    await expect(page.getByRole("heading", { name: /Order confirmed|Confirming/ })).toBeVisible({ timeout: 30_000 });
  } else {
    await expect(page.getByText("Payments aren't set up on this site yet")).toBeVisible();
  }
});
