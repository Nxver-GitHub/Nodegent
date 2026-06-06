/**
 * sso-auth-worker.js
 * ------------------
 * Playwright UCSC Canvas SSO authentication — runs in a Node.js worker thread
 * so the Next.js server stays responsive during the Chromium + MFA flow.
 *
 * Config is passed via workerData (not imported) so this file has no TypeScript
 * dependencies and can be loaded directly by Node's worker_threads module.
 *
 * Security notes:
 *  - Credentials exist in memory only for the duration of this worker.
 *  - Screenshots are paused during password fill so the field value is never
 *    streamed to the viewer tab.
 *  - Extracted cookies are sent once to the parent via 'done' message and
 *    never stored in this module.
 */

import { parentPort, workerData } from 'node:worker_threads';

const {
  username,
  password,
  canvasBaseUrl,
  canvasSsoUrl,
  sessionDir,
  ssoTimeoutMs,
  sessionCheckMs,
  playwrightOptions,
  screenshotIntervalMs,
  screenshotQuality,
} = workerData;

// ---------------------------------------------------------------------------
// CSS selectors for the UCSC SSO + Duo login form
// ---------------------------------------------------------------------------

const SEL = {
  username: [
    'input#username',
    'input#j_username',
    'input[name="username"]',
    'input[name="j_username"]',
    'input[name="IDToken1"]',
    'input[name="callback_0"]',
    'input[placeholder="CruzID"]',
    'input[aria-label="CruzID"]',
    'input[autocomplete="username"]',
    'input[type="email"]',
    'input[type="text"]',
  ].join(', '),
  password: [
    'input#password',
    'input#j_password',
    'input[name="password"]',
    'input[name="j_password"]',
    'input[name="IDToken2"]',
    'input[name="callback_1"]',
    'input[placeholder="Gold Password"]',
    'input[aria-label="Gold Password"]',
    'input[autocomplete="current-password"]',
    'input[type="password"]',
  ].join(', '),
  submit: [
    'input[name="submit"]',
    'input[type="submit"]',
    'input[value="Log in"]',
    'input[value="Login"]',
    'input[value="Sign in"]',
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Login")',
    'button:has-text("Sign in")',
    'button:has-text("Continue")',
  ].join(', '),
  canvasApp: '#application, #content, nav#main-nav',
  duoTrust: 'button[aria-label*="trust" i], button:has-text("Yes, trust browser"), #trust-browser-label',
  duoLegacyFrame: 'iframe[title*="Duo" i], iframe#duo_iframe',
  duoLegacyRememberMe: 'input[name="dampen_choice"]',
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let chromium = null;
let context = null;
let activePage = null;
let loopHandle = null;
let streamingPaused = false;
let captureInProgress = false;
let aborted = false;

// ---------------------------------------------------------------------------
// Parent message handling
// ---------------------------------------------------------------------------

parentPort.on('message', (msg) => {
  if (msg?.type === 'pause') {
    setStreamingPaused(msg.paused);
    return;
  }
  if (msg?.type === 'click') {
    handleClick(msg);
    return;
  }
  if (msg?.type === 'abort') {
    aborted = true;
    stopScreenshotLoop();
    context?.close().catch(() => {});
  }
});

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((err) => {
  if (!aborted) parentPort.postMessage({ type: 'error', message: err.message });
});

async function main() {
  await loadChromium();
  if (workerData.mode === 'warmup') return;

  const result = await runAuth(username, password);
  parentPort.postMessage({ type: 'done', ...result });
}

async function loadChromium() {
  parentPort.postMessage({ type: 'status', message: 'Loading browser engine...' });
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isVercel) {
    const chromiumPkg = (await import('@sparticuz/chromium')).default;
    const { chromium: pwChromium } = await import('playwright-core');
    // Wrap so the rest of the worker uses the same interface
    chromium = {
      _sparticuzPkg: chromiumPkg,
      _pwChromium: pwChromium,
      _isServerless: true,
    };
  } else {
    const mod = await import('playwright');
    chromium = mod.chromium;
  }
  parentPort.postMessage({ type: 'playwright-ready' });
}

// ---------------------------------------------------------------------------
// Auth flow
// ---------------------------------------------------------------------------

async function runAuth(uname, pwd) {
  throwIfAborted();
  let browser = null;
  try {
    parentPort.postMessage({ type: 'status', message: 'Opening browser session...' });

    if (chromium._isServerless) {
      // Serverless: use @sparticuz/chromium + playwright-core
      const chromiumPkg = chromium._sparticuzPkg;
      const pwChromium = chromium._pwChromium;
      browser = await pwChromium.launch({
        args: chromiumPkg.args,
        executablePath: await chromiumPkg.executablePath(),
        headless: chromiumPkg.headless,
      });
      context = await browser.newContext();
    } else {
      // Local dev: use persistent context with session dir
      context = await chromium.launchPersistentContext(sessionDir, playwrightOptions);
    }

    throwIfAborted();
    activePage = context.pages()[0] ?? await context.newPage();
    startScreenshotLoop(activePage);

    try {
      return await authenticate(context, activePage, uname, pwd);
    } finally {
      stopScreenshotLoop();
      await activePage?.close().catch(() => {});
    }
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

function throwIfAborted() {
  if (aborted) {
    throw new Error('Authentication was cancelled because the viewer disconnected.');
  }
}

async function authenticate(browserContext, page, uname, pwd) {
  parentPort.postMessage({ type: 'status', message: 'Checking saved Canvas session...' });
  await page.goto(canvasBaseUrl, { waitUntil: 'domcontentloaded', timeout: ssoTimeoutMs });

  const sessionValid = await page
    .waitForSelector(SEL.canvasApp, { timeout: sessionCheckMs })
    .then(() => true)
    .catch(() => false);

  if (sessionValid) {
    const cookies = await extractCookies(browserContext);
    return { cookies, sessionRestored: true };
  }

  if (!uname || !pwd) {
    throw new Error('Session expired. Enter your CruzID and password to log in again.');
  }

  parentPort.postMessage({ type: 'status', message: 'Navigating to UCSC SSO...' });
  await page.goto(canvasSsoUrl, { waitUntil: 'domcontentloaded', timeout: ssoTimeoutMs });
  await page.waitForURL(/login\.ucsc\.edu|canvas\.ucsc\.edu|login\.instructure\.com/, {
    timeout: ssoTimeoutMs,
  });

  await fillFirstVisible(page, SEL.username, uname, 'CruzID');

  // Pause screenshots while the password field is active so the typed value
  // is never captured in a streamed frame.
  setStreamingPaused(true);
  await fillFirstVisible(page, SEL.password, pwd, 'Gold Password');
  // Resume after the form submits — the password field will be cleared
  parentPort.postMessage({ type: 'status', message: 'Submitting login form...' });

  await Promise.all([
    page.waitForURL(/duosecurity\.com|canvas\.ucsc\.edu|login\.ucsc\.edu/, {
      timeout: ssoTimeoutMs,
    }).catch(() => {}),
    clickFirstVisible(page, SEL.submit, 'submit button'),
  ]);

  // Resume screenshot stream after submit — password no longer visible
  setStreamingPaused(false);

  // UCSC routes Duo through its own SSO domain rather than redirecting to
  // duosecurity.com directly, so content-based selectors are the reliable signal.
  const DUO_DETECT_SEL = [
    'button:has-text("Skip for now")',
    'button:has-text("Send Me a Push")',
    'button:has-text("Use Duo Mobile")',
    'button:has-text("Other options")',
  ].join(', ');

  const postLogin = await Promise.race([
    // Content-based detection (works regardless of hosting domain)
    page.waitForSelector(DUO_DETECT_SEL, { timeout: 20_000 }).then(() => 'duo-universal'),
    page.waitForSelector(SEL.duoLegacyFrame, { timeout: 20_000 }).then(() => 'duo-legacy'),
    page.waitForURL(`${canvasBaseUrl}/**`, { timeout: 20_000 }).then(() => 'canvas'),
    // URL-based fallback for schools that do redirect to duosecurity.com
    page.waitForURL(/duosecurity\.com/, { timeout: 20_000 }).then(() => 'duo-universal'),
  ]).catch(() => 'unknown');

  if (postLogin === 'duo-universal') {
    parentPort.postMessage({ type: 'status', message: 'Waiting for Duo approval on your phone...' });
    await handleDuoUniversal(page);
  } else if (postLogin === 'duo-legacy') {
    parentPort.postMessage({ type: 'status', message: 'Waiting for Duo approval...' });
    await handleDuoLegacy(page);
  } else if (postLogin === 'unknown') {
    // Last chance: check by content before falling back to plain Canvas wait
    const duoVisible = await page.waitForSelector(DUO_DETECT_SEL, { timeout: 10_000 })
      .then(() => true).catch(() => false);
    if (duoVisible) {
      parentPort.postMessage({ type: 'status', message: 'Waiting for Duo approval on your phone...' });
      await handleDuoUniversal(page);
    } else {
      parentPort.postMessage({ type: 'status', message: 'Waiting for Canvas redirect...' });
    }
  }

  await page.waitForURL(`${canvasBaseUrl}/**`, { timeout: ssoTimeoutMs });
  await page.waitForSelector(SEL.canvasApp, { timeout: 30_000 });

  const cookies = await extractCookies(browserContext);
  return { cookies, sessionRestored: false };
}

async function handleDuoUniversal(page) {
  // Duo may show a "Desktop local network access" interstitial before sending a push.
  // Click "Skip for now" automatically so the flow continues to the push screen.
  try {
    const skipBtn = page.locator('button', { hasText: /skip for now/i });
    await skipBtn.waitFor({ state: 'visible', timeout: 8_000 });
    parentPort.postMessage({ type: 'status', message: 'Skipping Duo Desktop network dialog...' });
    await skipBtn.click();
    await page.waitForTimeout(500);
  } catch {
    // Dialog not shown — already past this step
  }

  parentPort.postMessage({ type: 'status', message: 'Approve the Duo push on your phone...' });

  // Duo may require additional verification ("Additional Duo Push required") when
  // the login comes from an unfamiliar location (Vercel's servers).  Auto-click
  // "Try again" to send a fresh push; allow up to 3 total attempts.
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await Promise.race([
      page.waitForSelector(SEL.duoTrust, { timeout: 55_000 }).then(() => 'trust'),
      page.waitForSelector('button:has-text("Try again")', { timeout: 55_000 }).then(() => 'retry'),
    ]).catch(() => null);

    if (result === 'trust') {
      parentPort.postMessage({ type: 'status', message: 'Trusting browser to skip Duo next time...' });
      await page.click(SEL.duoTrust).catch(() => {});
      return;
    }

    if (result === 'retry') {
      parentPort.postMessage({
        type: 'status',
        message: `Duo needs additional verification — approve the next push on your phone (attempt ${attempt + 2}/3)...`,
      });
      await page.click('button:has-text("Try again")').catch(() => {});
      await page.waitForTimeout(1_500);
      // loop continues for next attempt
    } else {
      break; // timeout — fall through to outer waitForURL
    }
  }
}

async function handleDuoLegacy(page) {
  try {
    const frameEl = await page.$(SEL.duoLegacyFrame);
    if (frameEl) {
      const frame = await frameEl.contentFrame();
      const cb = frame ? await frame.$(SEL.duoLegacyRememberMe) : null;
      if (cb) await cb.click().catch(() => {});
    }
  } catch {
    // Non-fatal — user can interact via the mirrored browser view
  }
  await page.waitForURL(`${canvasBaseUrl}/**`, { timeout: ssoTimeoutMs }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Cookie extraction — only canvas.ucsc.edu session cookies
// ---------------------------------------------------------------------------

async function extractCookies(browserContext) {
  const all = await browserContext.cookies();
  const cookies = all.filter((c) => c.domain.includes('canvas.ucsc.edu'));
  if (cookies.length === 0) {
    throw new Error('Authenticated but no Canvas session cookies were found.');
  }
  return cookies;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fillFirstVisible(page, selector, value, label) {
  try {
    await page.locator(selector).first().fill(value, { timeout: ssoTimeoutMs });
  } catch {
    throw new Error(
      `Could not find an editable ${label} field on ${page.url()}. UCSC may have changed the login form.`
    );
  }
}

async function clickFirstVisible(page, selector, label) {
  try {
    await page.locator(selector).first().click({ timeout: ssoTimeoutMs });
  } catch {
    throw new Error(
      `Could not find an enabled ${label} on ${page.url()}. UCSC may have changed the login form.`
    );
  }
}

// ---------------------------------------------------------------------------
// Screenshot loop
// ---------------------------------------------------------------------------

function startScreenshotLoop(page) {
  stopScreenshotLoop();
  activePage = page;
  ensureCaptureScheduled(0);
}

function stopScreenshotLoop() {
  if (loopHandle !== null) {
    clearTimeout(loopHandle);
    loopHandle = null;
  }
  activePage = null;
  captureInProgress = false;
}

function setStreamingPaused(paused) {
  streamingPaused = Boolean(paused);
  if (streamingPaused) {
    if (loopHandle !== null) {
      clearTimeout(loopHandle);
      loopHandle = null;
    }
  } else {
    ensureCaptureScheduled(0);
  }
}

function ensureCaptureScheduled(delayMs = screenshotIntervalMs) {
  if (!activePage || streamingPaused || captureInProgress || loopHandle !== null) return;
  loopHandle = setTimeout(captureFrame, delayMs);
}

async function captureFrame() {
  loopHandle = null;
  if (!activePage || streamingPaused) return;

  const page = activePage;
  captureInProgress = true;
  try {
    const buf = await page.screenshot({ type: 'jpeg', quality: screenshotQuality });
    if (page === activePage && !streamingPaused) {
      parentPort.postMessage({ type: 'frame', data: buf.toString('base64') });
    }
  } catch {
    // Page may be mid-navigation — skip this frame silently
  } finally {
    captureInProgress = false;
  }

  ensureCaptureScheduled();
}

// ---------------------------------------------------------------------------
// Click forwarding
// ---------------------------------------------------------------------------

async function handleClick(msg) {
  try {
    await forwardClick(msg.x, msg.y, msg.viewportWidth, msg.viewportHeight);
    parentPort.postMessage({ type: 'click-result', id: msg.id, ok: true });
  } catch (err) {
    parentPort.postMessage({ type: 'click-result', id: msg.id, ok: false, error: err.message });
  }
}

async function forwardClick(x, y, viewportWidth, viewportHeight) {
  if (!activePage) throw new Error('No active auth session to forward click to.');
  const vp = activePage.viewportSize();
  const scaleX = vp ? vp.width / viewportWidth : 1;
  const scaleY = vp ? vp.height / viewportHeight : 1;
  await activePage.mouse.click(x * scaleX, y * scaleY);
}
