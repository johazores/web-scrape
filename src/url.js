const crypto = require("crypto");

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "ref",
]);

const SKIPPED_EXTENSIONS = new Set([
  ".7z",
  ".avi",
  ".css",
  ".doc",
  ".docx",
  ".eot",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".map",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".ogg",
  ".otf",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".rar",
  ".rss",
  ".svg",
  ".tar",
  ".tif",
  ".tiff",
  ".ttf",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".xls",
  ".xlsx",
  ".xml",
  ".zip",
]);

const MEDIA_EXTENSIONS = new Set([
  ".7z",
  ".avi",
  ".doc",
  ".docx",
  ".gif",
  ".gz",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mov",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".ogg",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".rar",
  ".svg",
  ".tar",
  ".tif",
  ".tiff",
  ".wav",
  ".webm",
  ".webp",
  ".xls",
  ".xlsx",
  ".zip",
]);

function safeUrl(value, baseUrl) {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  try {
    const url = new URL(trimmed, baseUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function normalizeUrl(value, baseUrl, config = {}) {
  const url = safeUrl(value, baseUrl);

  if (!url) {
    return null;
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  const removeQueryParams = new Set(config.removeQueryParams || []);

  for (const key of [...url.searchParams.keys()]) {
    const lowerKey = key.toLowerCase();
    const isTracking = lowerKey.startsWith("utm_") || TRACKING_PARAMETERS.has(lowerKey);

    if (removeQueryParams.has(key) || (config.dropTrackingParams && isTracking)) {
      url.searchParams.delete(key);
    }
  }

  const sortedEntries = [...url.searchParams.entries()].sort(([keyA, valueA], [keyB, valueB]) => {
    const keyComparison = keyA.localeCompare(keyB);
    return keyComparison || valueA.localeCompare(valueB);
  });

  url.search = "";

  for (const [key, value] of sortedEntries) {
    url.searchParams.append(key, value);
  }

  return url.href;
}

function isInternalUrl(value, config) {
  const url = safeUrl(value, config.baseUrl);
  return Boolean(url && config.allowedHosts.has(url.hostname.toLowerCase()));
}

function getExtension(value) {
  const url = safeUrl(value);

  if (!url) {
    return "";
  }

  const lastSegment = url.pathname.split("/").pop() || "";
  const dotIndex = lastSegment.lastIndexOf(".");

  return dotIndex === -1 ? "" : lastSegment.slice(dotIndex).toLowerCase();
}

function wildcardToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i");
}

function matchesPattern(url, pattern) {
  if (!pattern) {
    return false;
  }

  const parsed = safeUrl(url);

  if (!parsed) {
    return false;
  }

  const targets = [parsed.href, `${parsed.pathname}${parsed.search}`];
  const matcher = wildcardToRegExp(pattern);

  return targets.some((target) => matcher.test(target));
}

function isCrawlableUrl(value, config) {
  const normalized = normalizeUrl(value, config.baseUrl, config);

  if (!normalized || !isInternalUrl(normalized, config)) {
    return false;
  }

  if (SKIPPED_EXTENSIONS.has(getExtension(normalized))) {
    return false;
  }

  if (
    config.includePatterns.length > 0 &&
    !config.includePatterns.some((pattern) => matchesPattern(normalized, pattern))
  ) {
    return false;
  }

  if (config.excludePatterns.some((pattern) => matchesPattern(normalized, pattern))) {
    return false;
  }

  return true;
}

function isMediaUrl(value) {
  return MEDIA_EXTENSIONS.has(getExtension(value));
}

function shortHash(value, length = 10) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, length);
}

module.exports = {
  getExtension,
  isCrawlableUrl,
  isInternalUrl,
  isMediaUrl,
  matchesPattern,
  normalizeUrl,
  safeUrl,
  shortHash,
  wildcardToRegExp,
};
