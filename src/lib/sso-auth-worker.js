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
  // @playwright/test re-exports chromium from playwright
  const mod = await import('@playwright/test');
  chromium = mod.chromium;
  parentPort.postMessage({ type: 'playwright-ready' });
}

// ---------------------------------------------------------------------------
// Auth flow
// ---------------------------------------------------------------------------

async function runAuth(uname, pwd) {
  throwIfAborted();
  try {
    parentPort.postMessage({ type: 'status', message: 'Opening browser session...' });
    context = await chromium.launchPersistentContext(sessionDir, playwrightOptions);
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

  const postLogin = await Promise.race([
    page.waitForURL('**/duosecurity.com/**', { timeout: 8_000 }).then(() => 'duo-universal'),
    page.waitForSelector(SEL.duoLegacyFrame, { timeout: 8_000 }).then(() => 'duo-legacy'),
    page.waitForURL(`${canvasBaseUrl}/**`, { timeout: 8_000 }).then(() => 'canvas'),
  ]).catch(() => 'unknown');

  if (postLogin === 'duo-universal') {
    parentPort.postMessage({ type: 'status', message: 'Waiting for Duo approval on your phone...' });
    await handleDuoUniversal(page);
  } else if (postLogin === 'duo-legacy') {
    parentPort.postMessage({ type: 'status', message: 'Waiting for Duo approval...' });
    await handleDuoLegacy(page);
  } else if (postLogin === 'unknown') {
    parentPort.postMessage({ type: 'status', message: 'Waiting for Canvas redirect...' });
  }

  await page.waitForURL(`${canvasBaseUrl}/**`, { timeout: ssoTimeoutMs });
  await page.waitForSelector(SEL.canvasApp, { timeout: 30_000 });

  const cookies = await extractCookies(browserContext);
  return { cookies, sessionRestored: false };
}

async function handleDuoUniversal(page) {
  const trustPageAppeared = await page
    .waitForSelector(SEL.duoTrust, { timeout: ssoTimeoutMs })
    .then(() => true)
    .catch(() => false);

  if (trustPageAppeared) {
    parentPort.postMessage({ type: 'status', message: 'Trusting browser to skip Duo next time...' });
    await page.click(SEL.duoTrust).catch(() => {});
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
