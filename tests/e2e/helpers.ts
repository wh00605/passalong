import { expect, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const DEMO_PASSWORD = "passalong-demo-pass"; // seeded test accounts (prisma/seed-data/sample.ts)

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@passalong.test`;
}

/** Reads the newest development email sent to an address (dev mailer writes JSON files to ./.emails). */
export async function latestEmailLink(to: string, timeoutMs = 15_000): Promise<string> {
  const dir = path.resolve(".emails");
  const safe = to.replace(/[^a-z0-9@._-]/gi, "_");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(`${safe}.json`)).sort();
    if (files.length) {
      const msg = JSON.parse(await readFile(path.join(dir, files.at(-1)!), "utf8")) as { action?: { url: string } };
      if (msg.action?.url) return msg.action.url;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No email received for ${to}`);
}

export async function acceptCookieChoice(page: Page) {
  const url = new URL(page.url() === "about:blank" ? "http://localhost:3000" : page.url());
  await page.context().addCookies([
    { name: "pa_consent", value: encodeURIComponent(JSON.stringify({ analytics: false, marketing: false, version: "2026-10-01" })), domain: url.hostname, path: "/" },
  ]);
}

export async function logIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await acceptCookieChoice(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible();
}

export async function logOut(page: Page) {
  await page.context().clearCookies();
}
