const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath = process.env.ENV_FILE || ".env") {
  const resolvedPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    return;
  }

  const lines = fs.readFileSync(resolvedPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getBoolean(name, fallback) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return fallback;
  }

  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  throw new Error(`${name} must be true or false.`);
}

function getInteger(name, fallback, minimum = 0) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }

  return parsed;
}

function getList(name, fallback = []) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getHeaders(value) {
  if (!value) {
    return {};
  }

  try {
    const headers = JSON.parse(value);

    if (!headers || Array.isArray(headers) || typeof headers !== "object") {
      throw new Error("Header value must be an object.");
    }

    return Object.fromEntries(
      Object.entries(headers).map(([key, headerValue]) => [key, String(headerValue)])
    );
  } catch (error) {
    throw new Error(`EXTRA_HEADERS must be valid JSON: ${error.message}`);
  }
}

function normalizeBaseUrl(value) {
  if (!value) {
    throw new Error("BASE_URL is required. Copy .env.example to .env and set the website URL.");
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("BASE_URL must be a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("BASE_URL must use http or https.");
  }

  url.hash = "";
  url.search = "";

  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }

  return url.href;
}

function loadConfig() {
  loadEnvFile();

  const baseUrl = normalizeBaseUrl(process.env.BASE_URL);
  const base = new URL(baseUrl);
  const allowedHosts = new Set([base.hostname.toLowerCase()]);

  for (const host of getList("ALLOWED_HOSTS")) {
    allowedHosts.add(host.toLowerCase());
  }

  const outputFormats = getList("OUTPUT_FORMATS", ["json", "markdown", "csv"]);
  const supportedFormats = new Set(["json", "markdown", "csv"]);

  for (const format of outputFormats) {
    if (!supportedFormats.has(format)) {
      throw new Error(`Unsupported output format: ${format}`);
    }
  }

  const authType = (process.env.AUTH_TYPE || "").toLowerCase();

  if (authType && !["basic", "bearer"].includes(authType)) {
    throw new Error("AUTH_TYPE must be basic, bearer, or empty.");
  }

  return {
    baseUrl,
    baseOrigin: base.origin,
    allowedHosts,
    maxPages: getInteger("MAX_PAGES", 500, 1),
    maxDepth: getInteger("MAX_DEPTH", 5, 0),
    concurrency: getInteger("CONCURRENCY", 2, 1),
    requestTimeoutMs: getInteger("REQUEST_TIMEOUT_MS", 15000, 1000),
    requestDelayMs: getInteger("REQUEST_DELAY_MS", 500, 0),
    retryAttempts: getInteger("RETRY_ATTEMPTS", 2, 0),
    maxRedirects: getInteger("MAX_REDIRECTS", 10, 0),
    maxSitemaps: getInteger("MAX_SITEMAPS", 50, 1),
    userAgent: process.env.USER_AGENT || "WebsiteMigrationTool/1.0",
    respectRobots: getBoolean("RESPECT_ROBOTS", true),
    discoverSitemaps: getBoolean("DISCOVER_SITEMAPS", true),
    sitemapUrls: getList("SITEMAP_URLS"),
    includePatterns: getList("INCLUDE_URL_PATTERNS"),
    excludePatterns: getList("EXCLUDE_URL_PATTERNS", [
      "/wp-admin/*",
      "/login/*",
      "/cart/*",
      "/checkout/*",
    ]),
    removeQueryParams: getList("REMOVE_QUERY_PARAMS"),
    dropTrackingParams: getBoolean("DROP_TRACKING_PARAMS", true),
    outputDir: path.resolve(process.cwd(), process.env.OUTPUT_DIR || "output"),
    outputFormats: new Set(outputFormats),
    resume: getBoolean("RESUME", true),
    recrawlCompleted: getBoolean("RECRAWL_COMPLETED", false),
    downloadMedia: getBoolean("DOWNLOAD_MEDIA", false),
    maxMediaFiles: getInteger("MAX_MEDIA_FILES", 1000, 0),
    contentSelectors: getList("CONTENT_SELECTORS", [
      "main",
      "article",
      "#content",
      ".content",
      ".entry-content",
    ]),
    excludeSelectors: getList("EXCLUDE_SELECTORS", [
      "script",
      "style",
      "noscript",
      "iframe",
      "nav",
      "footer",
      ".cookie-banner",
      ".modal",
    ]),
    cookie: process.env.COOKIE || "",
    authType,
    authUsername: process.env.AUTH_USERNAME || "",
    authPassword: process.env.AUTH_PASSWORD || "",
    authToken: process.env.AUTH_TOKEN || "",
    extraHeaders: getHeaders(process.env.EXTRA_HEADERS),
    jsRendering: getBoolean("JS_RENDERING", false),
    jsRenderWaitMs: getInteger("JS_RENDER_WAIT_MS", 0, 0),
  };
}

module.exports = {
  getBoolean,
  getInteger,
  getList,
  loadConfig,
  loadEnvFile,
};
