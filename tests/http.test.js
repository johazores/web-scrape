const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildHeaders,
  createHttpClient,
  parseRetryAfter,
} = require("../src/http");

function config(overrides = {}) {
  return {
    baseUrl: "https://example.com/",
    allowedHosts: new Set(["example.com"]),
    userAgent: "WebsiteMigrationTool/1.0",
    extraHeaders: { "X-Migration-Key": "secret" },
    cookie: "session=secret",
    authType: "bearer",
    authToken: "token",
    authUsername: "",
    authPassword: "",
    requestDelayMs: 0,
    requestTimeoutMs: 1000,
    retryAttempts: 0,
    maxRedirects: 5,
    ...overrides,
  };
}

test("sends credentials only to explicitly allowed hosts", () => {
  const internal = buildHeaders(config(), "https://example.com/page");
  const external = buildHeaders(config(), "https://cdn.example.net/file");

  assert.equal(internal.Authorization, "Bearer token");
  assert.equal(internal.Cookie, "session=secret");
  assert.equal(internal["X-Migration-Key"], "secret");
  assert.equal(external.Authorization, undefined);
  assert.equal(external.Cookie, undefined);
  assert.equal(external["X-Migration-Key"], undefined);
});

test("blocks an external redirect before requesting its target", async () => {
  const requestedUrls = [];
  const request = async ({ url }) => {
    requestedUrls.push(url);
    return {
      status: 302,
      headers: { location: "https://external.example/page" },
      data: "",
    };
  };
  const client = createHttpClient(config(), request);
  const response = await client.get("https://example.com/start", {
    allowRedirect: (nextUrl) => new URL(nextUrl).hostname === "example.com",
  });

  assert.deepEqual(requestedUrls, ["https://example.com/start"]);
  assert.equal(response.redirectBlocked, "https://external.example/page");
  assert.equal(response.redirects[0].blocked, true);
});

test("detects redirect loops", async () => {
  const request = async ({ url }) => ({
    status: 302,
    headers: {
      location: url.endsWith("/one")
        ? "https://example.com/two"
        : "https://example.com/one",
    },
    data: "",
  });
  const client = createHttpClient(config(), request);

  await assert.rejects(
    () => client.get("https://example.com/one"),
    /Redirect loop detected/
  );
});

test("parses retry-after seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter("5", 0), 5000);
  assert.equal(
    parseRetryAfter("Thu, 01 Jan 1970 00:00:10 GMT", 5000),
    5000
  );
});
