import { test, expect } from "@playwright/test";

test("signs into Pockaa with email and password", async ({ page }) => {
  const identifier = process.env.E2E_CLERK_USER_USERNAME;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!identifier || !password) {
    throw new Error(
      "Set E2E_CLERK_USER_USERNAME and E2E_CLERK_USER_PASSWORD in .env.test",
    );
  }

  await page.goto("/sign-in");

  await page.locator('input[name="identifier"]').fill(identifier);
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await expect(page.locator('input[name="password"]')).toBeVisible();
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await page.waitForLoadState("networkidle");

  if (page.url().includes("/sign-in/factor-two")) {
    throw new Error(
      "Email + password succeeded, but Clerk required email verification for a new device at /sign-in/factor-two.",
    );
  }

  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
    timeout: 30_000,
  });
  await expect(page).not.toHaveURL(/\/sign-in/);
});
