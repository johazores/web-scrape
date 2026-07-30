const { createScheduler, sleep } = require("./http");

async function createRenderer(config) {
  let playwright;

  try {
    playwright = require("playwright");
  } catch {
    throw new Error(
      "JS_RENDERING=true requires Playwright. Install it with npm install --save-dev playwright and run npx playwright install chromium."
    );
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const extraHTTPHeaders = { ...config.extraHeaders };

  if (config.authType === "bearer" && config.authToken) {
    extraHTTPHeaders.Authorization = `Bearer ${config.authToken}`;
  }

  const context = await browser.newContext({
    userAgent: config.userAgent,
    extraHTTPHeaders,
    httpCredentials:
      config.authType === "basic"
        ? {
            username: config.authUsername,
            password: config.authPassword,
          }
        : undefined,
  });

  if (config.cookie) {
    const cookies = config.cookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return {
          name: part.slice(0, separator),
          value: part.slice(separator + 1),
          domain: new URL(config.baseUrl).hostname,
          path: "/",
        };
      })
      .filter((cookie) => cookie.name);

    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }
  }

  const waitForTurn = createScheduler(config.requestDelayMs);

  async function get(url) {
    await waitForTurn();
    const page = await context.newPage();
    const startedAt = Date.now();

    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: config.requestTimeoutMs,
      });

      if (config.jsRenderWaitMs > 0) {
        await sleep(config.jsRenderWaitMs);
      }

      return {
        requestedUrl: url,
        finalUrl: page.url(),
        status: response?.status() || 200,
        headers: response ? await response.allHeaders() : {},
        data: await page.content(),
        redirects: [],
        durationMs: Date.now() - startedAt,
      };
    } finally {
      await page.close();
    }
  }

  return {
    get,
    close: () => browser.close(),
  };
}

module.exports = {
  createRenderer,
};
