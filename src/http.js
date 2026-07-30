const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createScheduler(delayMs) {
  let chain = Promise.resolve();
  let lastStartedAt = 0;

  return async function waitForTurn() {
    const turn = chain.then(async () => {
      const remaining = Math.max(0, delayMs - (Date.now() - lastStartedAt));

      if (remaining > 0) {
        await sleep(remaining);
      }

      lastStartedAt = Date.now();
    });

    chain = turn.catch(() => {});
    await turn;
  };
}

function isAllowedCredentialHost(config, urlValue) {
  try {
    const url = new URL(urlValue || config.baseUrl);
    return config.allowedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function buildHeaders(config, urlValue) {
  const headers = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": config.userAgent,
  };

  if (!isAllowedCredentialHost(config, urlValue)) {
    return headers;
  }

  Object.assign(headers, config.extraHeaders);

  if (config.cookie) {
    headers.Cookie = config.cookie;
  }

  if (config.authType === "bearer" && config.authToken) {
    headers.Authorization = `Bearer ${config.authToken}`;
  }

  if (config.authType === "basic") {
    const credentials = Buffer.from(
      `${config.authUsername}:${config.authPassword}`
    ).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  }

  return headers;
}

function parseRetryAfter(value, now = Date.now()) {
  if (!value) {
    return null;
  }

  const seconds = Number.parseInt(value, 10);

  if (Number.isFinite(seconds) && String(seconds) === String(value).trim()) {
    return Math.max(0, seconds * 1000);
  }

  const retryAt = Date.parse(value);

  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - now);
  }

  return null;
}

function createHttpClient(config, requestFunction) {
  const waitForTurn = createScheduler(config.requestDelayMs);
  const request =
    requestFunction ||
    ((options) => {
      const axios = require("axios");
      return axios.request(options);
    });

  async function requestOnce(url, options = {}) {
    await waitForTurn();

    return request({
      url,
      method: "GET",
      timeout: config.requestTimeoutMs,
      maxRedirects: 0,
      responseType: options.responseType || "text",
      validateStatus: () => true,
      headers: {
        ...buildHeaders(config, url),
        ...(options.headers || {}),
      },
    });
  }

  async function requestWithRetry(url, options = {}) {
    let lastError;

    for (let attempt = 0; attempt <= config.retryAttempts; attempt += 1) {
      try {
        const response = await requestOnce(url, options);

        if (!RETRY_STATUSES.has(response.status) || attempt === config.retryAttempts) {
          return response;
        }

        const retryAfter = parseRetryAfter(response.headers["retry-after"]);
        const delay = retryAfter ?? Math.min(1000 * 2 ** attempt, 10000);

        await sleep(delay);
      } catch (error) {
        lastError = error;

        if (attempt === config.retryAttempts) {
          throw error;
        }

        await sleep(Math.min(1000 * 2 ** attempt, 10000));
      }
    }

    throw lastError || new Error(`Request failed: ${url}`);
  }

  async function get(url, options = {}) {
    const requestedUrl = url;
    const redirects = [];
    const seenUrls = new Set([url]);
    const startedAt = Date.now();
    let currentUrl = url;

    for (let redirectCount = 0; redirectCount <= config.maxRedirects; redirectCount += 1) {
      const response = await requestWithRetry(currentUrl, options);

      if (REDIRECT_STATUSES.has(response.status) && response.headers.location) {
        if (redirectCount === config.maxRedirects) {
          const error = new Error(`Maximum redirects exceeded for ${requestedUrl}`);
          error.status = response.status;
          error.redirects = redirects;
          throw error;
        }

        const nextUrl = new URL(response.headers.location, currentUrl).href;
        const redirect = {
          from: currentUrl,
          to: nextUrl,
          status: response.status,
        };
        redirects.push(redirect);

        if (seenUrls.has(nextUrl)) {
          const error = new Error(`Redirect loop detected for ${requestedUrl}`);
          error.status = response.status;
          error.redirects = redirects;
          throw error;
        }

        if (
          options.allowRedirect &&
          !options.allowRedirect(nextUrl, currentUrl, response)
        ) {
          redirect.blocked = true;

          return {
            requestedUrl,
            finalUrl: currentUrl,
            status: response.status,
            headers: response.headers,
            data: response.data,
            redirects,
            redirectBlocked: nextUrl,
            durationMs: Date.now() - startedAt,
          };
        }

        seenUrls.add(nextUrl);
        currentUrl = nextUrl;
        continue;
      }

      return {
        requestedUrl,
        finalUrl: currentUrl,
        status: response.status,
        headers: response.headers,
        data: response.data,
        redirects,
        redirectBlocked: null,
        durationMs: Date.now() - startedAt,
      };
    }

    throw new Error(`Unable to complete request for ${requestedUrl}`);
  }

  return {
    get,
    waitForTurn,
  };
}

module.exports = {
  buildHeaders,
  createHttpClient,
  createScheduler,
  isAllowedCredentialHost,
  parseRetryAfter,
  sleep,
};
