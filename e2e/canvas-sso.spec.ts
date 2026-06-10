/**
 * Canvas SSO E2E tests — both Duo MFA flows
 *
 * These tests mock /api/canvas-auth/* at the network layer via page.route()
 * so no real UCSC SSO or Duo calls are made. Production routes are untouched.
 *
 * Prerequisites:
 *  - Clerk auth state at e2e/.auth/user.json (run `npm run test:e2e:auth` to generate)
 *  - Dev server running on http://localhost:3000
 *
 * The test user must not have Canvas connected, OR the reconnect param must
 * trigger the auth form. If Canvas is already connected and not expired the
 * tests log a skip message — connect/expire Canvas for that account first.
 */

import { test, expect } from "@playwright/test";
import { existsSync } from "fs";

const AUTH_STATE = "e2e/.auth/user.json";
const hasAuth = existsSync(AUTH_STATE);

// Minimal 1×1 white JPEG — used for frame SSE events so the img tag renders
const BLANK_FRAME =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

function sseBody(events: Array<{ event: string; data: unknown }>): string {
  return events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
}

function mockCanvasRoutes(page: import("@playwright/test").Page) {
  return Promise.all([
    page.route("/api/canvas-auth/pause", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
    ),
    page.route("/api/canvas-auth/click", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Helper: open the Canvas auth form regardless of connection state
// ---------------------------------------------------------------------------
async function openCanvasAuthForm(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  // Already showing the form (user has no Canvas connected)
  const formVisible = await page
    .locator('[autocomplete="username"]')
    .isVisible()
    .catch(() => false);
  if (formVisible) return true;

  // Canvas connected but expired → click Reconnect
  const reconnectBtn = page.getByRole("button", { name: /reconnect/i });
  if (await reconnectBtn.isVisible().catch(() => false)) {
    await reconnectBtn.click();
    await expect(page.locator('[autocomplete="username"]')).toBeVisible({ timeout: 5_000 });
    return true;
  }

  // Canvas connected and valid → cannot show auth form without expiring session
  return false;
}

// ---------------------------------------------------------------------------
// Flow 1-a: Normal Duo push — push approved, Canvas connected
// ---------------------------------------------------------------------------
test.describe("Canvas SSO — Duo push (Flow 1a)", () => {
  if (!hasAuth) test.skip(true, "Requires e2e/.auth/user.json");
  test.use({ storageState: AUTH_STATE });

  test("shows streaming mirror then connected state after push approval", async ({ page }) => {
    await mockCanvasRoutes(page);
    await page.route("/api/canvas-auth/stream", (r) =>
      r.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: sseBody([
          { event: "status", data: { message: "Opening browser session..." } },
          { event: "frame", data: BLANK_FRAME },
          { event: "status", data: { message: "Approve the Duo push on your phone..." } },
          { event: "done", data: { success: true, sessionRestored: false } },
        ]),
      })
    );

    const showed = await openCanvasAuthForm(page);
    if (!showed) {
      test.skip(true, "Canvas is already connected — expire the session to test this flow");
    }

    await page.fill('[autocomplete="username"]', "testuser");
    await page.fill('[autocomplete="current-password"]', "testpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="canvas-auth-streaming"]')).toBeVisible({
      timeout: 10_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Flow 1-b: Push fails → Duo falls back to 6-digit app passcode
// ---------------------------------------------------------------------------
test.describe("Canvas SSO — Duo app passcode fallback (Flow 1b)", () => {
  if (!hasAuth) test.skip(true, "Requires e2e/.auth/user.json");
  test.use({ storageState: AUTH_STATE });

  test("shows 6-digit passcode input when Duo push fails", async ({ page }) => {
    await mockCanvasRoutes(page);
    await page.route("/api/canvas-auth/stream", (r) =>
      r.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: sseBody([
          { event: "status", data: { message: "Opening browser session..." } },
          { event: "frame", data: BLANK_FRAME },
          { event: "status", data: { message: "Approve the Duo push on your phone..." } },
          { event: "status", data: { message: "Enter the 6-digit passcode from your Duo app." } },
          { event: "mfa-input-required", data: { variant: "app" } },
        ]),
      })
    );
    await page.route("/api/canvas-auth/type", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
    );

    const showed = await openCanvasAuthForm(page);
    if (!showed) test.skip(true, "Canvas is already connected — expire the session first");

    await page.fill('[autocomplete="username"]', "testuser");
    await page.fill('[autocomplete="current-password"]', "testpassword");
    await page.click('button[type="submit"]');

    const input = page.locator('[data-testid="canvas-mfa-passcode-input"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Label references 6-digit code
    await expect(page.locator('[data-testid="canvas-mfa-label"]')).toContainText("6-digit");

    // Mobile-friendly attributes
    await expect(input).toHaveAttribute("type", "tel");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(input).toHaveAttribute("autocomplete", "one-time-code");
    await expect(input).toHaveAttribute("maxlength", "6");

    // User enters code — submit enabled only when all digits filled
    const submitBtn = page.locator('[data-testid="canvas-mfa-submit"]');
    await expect(submitBtn).toBeDisabled(); // empty
    await input.fill("123456");
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Returns to streaming phase showing "Verifying…"
    await expect(page.locator('[data-testid="canvas-auth-streaming"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test("mobile viewport: passcode input triggers numeric keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockCanvasRoutes(page);
    await page.route("/api/canvas-auth/stream", (r) =>
      r.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: sseBody([
          { event: "mfa-input-required", data: { variant: "app" } },
        ]),
      })
    );
    await page.route("/api/canvas-auth/type", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
    );

    const showed = await openCanvasAuthForm(page);
    if (!showed) test.skip(true, "Canvas is already connected — expire the session first");

    await page.fill('[autocomplete="username"]', "testuser");
    await page.fill('[autocomplete="current-password"]', "testpassword");
    await page.click('button[type="submit"]');

    const input = page.locator('[data-testid="canvas-mfa-passcode-input"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    await expect(input).toHaveAttribute("type", "tel");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(input).toHaveAttribute("autocomplete", "one-time-code");
  });
});

// ---------------------------------------------------------------------------
// Flow 2: No Duo app → 7-digit SMS passcode
// ---------------------------------------------------------------------------
test.describe("Canvas SSO — SMS passcode (Flow 2)", () => {
  if (!hasAuth) test.skip(true, "Requires e2e/.auth/user.json");
  test.use({ storageState: AUTH_STATE });

  test("auto-sends SMS and shows 7-digit input for users without Duo app", async ({ page }) => {
    await mockCanvasRoutes(page);
    await page.route("/api/canvas-auth/stream", (r) =>
      r.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: sseBody([
          { event: "status", data: { message: "Opening browser session..." } },
          { event: "frame", data: BLANK_FRAME },
          { event: "status", data: { message: "Requesting a text passcode — please wait..." } },
          { event: "status", data: { message: "Enter the 7-digit code sent to your phone." } },
          { event: "mfa-input-required", data: { variant: "sms" } },
        ]),
      })
    );
    await page.route("/api/canvas-auth/type", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
    );

    const showed = await openCanvasAuthForm(page);
    if (!showed) test.skip(true, "Canvas is already connected — expire the session first");

    await page.fill('[autocomplete="username"]', "testuser");
    await page.fill('[autocomplete="current-password"]', "testpassword");
    await page.click('button[type="submit"]');

    const input = page.locator('[data-testid="canvas-mfa-passcode-input"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Label references 7-digit SMS code
    await expect(page.locator('[data-testid="canvas-mfa-label"]')).toContainText("7-digit");

    // SMS autofill hint for mobile browsers
    await expect(input).toHaveAttribute("autocomplete", "one-time-code");
    await expect(input).toHaveAttribute("maxlength", "7");

    // User enters 7-digit code
    const submitBtn = page.locator('[data-testid="canvas-mfa-submit"]');
    await expect(submitBtn).toBeDisabled(); // not enough digits
    await input.fill("1234567");
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.locator('[data-testid="canvas-auth-streaming"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test("mobile viewport: SMS input uses one-time-code autocomplete for autofill", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockCanvasRoutes(page);
    await page.route("/api/canvas-auth/stream", (r) =>
      r.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: sseBody([{ event: "mfa-input-required", data: { variant: "sms" } }]),
      })
    );
    await page.route("/api/canvas-auth/type", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
    );

    const showed = await openCanvasAuthForm(page);
    if (!showed) test.skip(true, "Canvas is already connected — expire the session first");

    await page.fill('[autocomplete="username"]', "testuser");
    await page.fill('[autocomplete="current-password"]', "testpassword");
    await page.click('button[type="submit"]');

    const input = page.locator('[data-testid="canvas-mfa-passcode-input"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    // These three attributes together trigger iOS/Android SMS autofill
    await expect(input).toHaveAttribute("type", "tel");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(input).toHaveAttribute("autocomplete", "one-time-code");
    await expect(input).toHaveAttribute("maxlength", "7");
  });
});
