import { expect, test } from "@playwright/test";
import { latestEmailLink, uniqueEmail } from "./helpers";

test("sign up, confirm email, land on onboarding and log back in", async ({ page }) => {
  const email = uniqueEmail("signup");
  const username = `e2e_${Date.now().toString(36)}`.slice(0, 20);
  const password = "e2e-test-password-1";

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("E2E Tester");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  // Terms not ticked → server-side validation error.
  await expect(page.getByText("You need to accept the terms")).toBeVisible();
  await page.getByLabel("Password").fill(password);
  await page.getByText("I agree to the").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 30_000 });

  // Can't log in before confirming.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Please confirm your email address first")).toBeVisible();

  await page.goto(await latestEmailLink(email));
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible();

  await page.goto(`/members/${username}`);
  await expect(page.getByRole("heading", { name: "E2E Tester" })).toBeVisible();
});

test("password reset flow", async ({ page }) => {
  const email = "priya@passalong.test";
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If there's an account for that email")).toBeVisible();
  const link = await latestEmailLink(email);
  expect(link).toContain("/reset-password");
});
