const { createScheduler, sleep } = require("./http");

function isAllowedHost(config, urlValue) {
  try {
    const url = new URL(urlValue);
    return config.allowedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function removeSensitiveHeaders(headers, config) {
  const sensitiveNames = new Set([
    "authorization",
    "cookie",
    ...Object.keys(config.extraHeaders).map((name) => name.toLowerCase()),
  ]);

  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => !sensitiveNames.has(name.toLowerCase())
    )
  );
}

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

  async function get(url, options = {}) {
    await waitForTurn();
    const page = await context.newPage();
    const startedAt = Date.now();
    let blockedNavigationUrl = null;

    await page.route("**/*", async (route) => {
      const request = route.request();
      const requestUrl = request.url();
      const allowed = isAllowedHost(config, requestUrl);

      if (
        !allowed &&
        request.resourceType() === "document" &&
        options.allowRedirect &&
        !options.allowRedirect(requestUrl, page.url())
      ) {
        blockedNavigationUrl = requestUrl;
        await route.abort("blockedbyclient");
        return;
      }

      if (!allowed) {
        await route.continue({
          headers: removeSensitiveHeaders(request.headers(), config),
        });
        return;
      }

      await route.continue();
    });

    try {
      let response;

      try {
        response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: config.requestTimeoutMs,
        });
      } catch (error) {
        if (!blockedNavigationUrl) {
          throw error;
        }
      }

      if (blockedNavigationUrl) {
        return {
          requestedUrl: url,
          finalUrl: page.url() || url,
          status: response?.status() || 0,
          headers: response ? await response.allHeaders() : {},
          data: "",
          redirects: [
            {
              from: url,
              to: blockedNavigationUrl,
              status: response?.status() || null,
              blocked: true,
            },
          ],
          redirectBlocked: blockedNavigationUrl,
          durationMs: Date.now() - startedAt,
        };
      }

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
        redirectBlocked: null,
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
  isAllowedHost,
  removeSensitiveHeaders,
};
