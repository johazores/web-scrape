const axios = require("axios");

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

function buildHeaders(config) {
  const headers = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": config.userAgent,
    ...config.extraHeaders,
  };

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

function createHttpClient(config) {
  const waitForTurn = createScheduler(config.requestDelayMs);
  const defaultHeaders = buildHeaders(config);

  async function requestOnce(url, options = {}) {
    await waitForTurn();

    return axios.request({
      url,
      method: "GET",
      timeout: config.requestTimeoutMs,
      maxRedirects: 0,
      responseType: options.responseType || "text",
      validateStatus: () => true,
      headers: {
        ...defaultHeaders,
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

        const retryAfter = Number.parseInt(response.headers["retry-after"], 10);
        const delay = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : Math.min(1000 * 2 ** attempt, 10000);

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
    const startedAt = Date.now();
    let currentUrl = url;

    for (let redirectCount = 0; redirectCount <= config.maxRedirects; redirectCount += 1) {
      const response = await requestWithRetry(currentUrl, options);

      if (REDIRECT_STATUSES.has(response.status) && response.headers.location) {
        if (redirectCount === config.maxRedirects) {
          throw new Error(`Maximum redirects exceeded for ${requestedUrl}`);
        }

        const nextUrl = new URL(response.headers.location, currentUrl).href;
        redirects.push({
          from: currentUrl,
          to: nextUrl,
          status: response.status,
        });
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
  sleep,
};
