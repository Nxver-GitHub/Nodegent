import { test, expect } from "@playwright/test";

/**
 * Snapshot panel & Weekly Digest tests.
 *
 * Unauthenticated tests run fully automatically.
 * Authenticated tests require a saved Clerk auth state at
 * e2e/.auth/user.json (run `npm run test:e2e:auth` to generate it).
 */

test.describe("Snapshot panel — unauthenticated", () => {
  test("dashboard redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("snapshot Today button is not reachable without auth", async ({ page }) => {
    await page.goto("/dashboard");
    // Should be redirected before the panel button ever mounts
    await expect(page.locator('button[aria-label="Open daily snapshot"]')).toHaveCount(0);
  });
});

/**
 * Authenticated digest tests.
 * These are skipped until a saved auth state exists.
 * To enable: create e2e/.auth/user.json via Clerk sign-in automation
 * and change `test.skip` to `test`.
 */
test.describe("Weekly Digest — authenticated", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test.skip("snapshot panel opens when Today button is clicked", async ({ page }) => {
    await page.goto("/dashboard");
    const todayBtn = page.locator('button[aria-label="Open daily snapshot"]');
    await expect(todayBtn).toBeVisible({ timeout: 10_000 });
    await todayBtn.click();
    const panel = page.locator('aside[aria-label="Daily snapshot"]');
    await expect(panel).toBeVisible();
  });

  test.skip("digest shows loading state then renders banner", async ({ page }) => {
    await page.goto("/dashboard");
    const todayBtn = page.locator('button[aria-label="Open daily snapshot"]');
    await expect(todayBtn).toBeVisible({ timeout: 10_000 });
    await todayBtn.click();

    // Loading spinner should appear briefly
    const spinner = page.locator('text=Generating your weekly summary');
    // It may resolve fast — check it appears OR the banner already appeared
    const banner = page.locator('[data-testid="weekly-digest-banner"]');
    const noKeyMsg = page.locator('text=digest unavailable');

    await expect(spinner.or(banner).or(noKeyMsg)).toBeVisible({ timeout: 5_000 });

    // After generation completes (allow up to 15s for Groq API round-trip)
    await expect(banner).toBeVisible({ timeout: 15_000 });
    // Banner should contain actual text content (not empty)
    const bannerText = await banner.textContent();
    expect(bannerText?.trim().length).toBeGreaterThan(20);
  });

  test.skip("digest banner can be dismissed and stays dismissed in the same session", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator('button[aria-label="Open daily snapshot"]').click();
    const banner = page.locator('[data-testid="weekly-digest-banner"]');
    await expect(banner).toBeVisible({ timeout: 15_000 });

    // Dismiss it
    await banner.locator('button[aria-label="Dismiss digest"]').click();
    await expect(banner).toHaveCount(0);

    // Close and reopen panel — should stay dismissed (sessionStorage)
    await page.locator('button[aria-label="Close snapshot"]').click();
    await page.locator('button[aria-label="Open daily snapshot"]').click();
    await expect(banner).toHaveCount(0);
  });
});

test.describe("Study Timer — unauthenticated", () => {
  test("timer overlay does not appear without auth", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[role="dialog"][aria-label="Study timer"]')).toHaveCount(0);
  });
});
