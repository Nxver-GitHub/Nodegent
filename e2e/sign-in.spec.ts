import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("unauthenticated user visiting /dashboard is redirected to sign-in", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-in page renders the Clerk sign-in component", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    // Clerk renders its sign-in widget inside a div with a specific data attribute
    const clerkWidget = page.locator("[data-clerk-component]").first();
    await expect(clerkWidget).toBeVisible({ timeout: 15_000 });
  });

  test("landing page shows Sign In link when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/");
    const signInLink = page.getByRole("link", { name: /sign in/i });
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute("href", "/sign-in");
  });

  test("landing page displays Nodegent heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Nodegent" })).toBeVisible();
  });
});
