const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isCrawlableUrl,
  matchesPattern,
  normalizeUrl,
} = require("../src/url");

function config(overrides = {}) {
  return {
    baseUrl: "https://example.com/",
    allowedHosts: new Set(["example.com"]),
    removeQueryParams: [],
    dropTrackingParams: true,
    includePatterns: [],
    excludePatterns: [],
    ...overrides,
  };
}

test("normalizes fragments, trailing slashes, tracking parameters, and query order", () => {
  const result = normalizeUrl(
    "https://EXAMPLE.com/about/?utm_source=test&b=2&a=1#team",
    "https://example.com/",
    config()
  );

  assert.equal(result, "https://example.com/about?a=1&b=2");
});

test("matches wildcard patterns against paths", () => {
  assert.equal(matchesPattern("https://example.com/wp-admin/edit", "/wp-admin/*"), true);
  assert.equal(matchesPattern("https://example.com/about", "/wp-admin/*"), false);
});

test("skips external URLs and non-page assets", () => {
  assert.equal(isCrawlableUrl("https://other.example/page", config()), false);
  assert.equal(isCrawlableUrl("https://example.com/file.pdf", config()), false);
  assert.equal(isCrawlableUrl("https://example.com/about", config()), true);
});

test("applies include and exclude patterns", () => {
  const options = config({
    includePatterns: ["/docs/*"],
    excludePatterns: ["/docs/private/*"],
  });

  assert.equal(isCrawlableUrl("https://example.com/docs/start", options), true);
  assert.equal(isCrawlableUrl("https://example.com/about", options), false);
  assert.equal(isCrawlableUrl("https://example.com/docs/private/one", options), false);
});


test("default-style exclusions match both a section root and its children", () => {
  assert.equal(matchesPattern("https://example.com/wp-admin", "/wp-admin*"), true);
  assert.equal(matchesPattern("https://example.com/wp-admin/edit", "/wp-admin*"), true);
});
