const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRobots } = require("../src/robots");

test("uses the most specific matching rule", () => {
  const robots = parseRobots(
    `
User-agent: *
Disallow: /private/
Allow: /private/public/
Sitemap: https://example.com/sitemap.xml
`,
    "WebsiteMigrationTool/1.0",
    "https://example.com/"
  );

  assert.equal(robots.isAllowed("https://example.com/private/page"), false);
  assert.equal(robots.isAllowed("https://example.com/private/public/page"), true);
  assert.deepEqual(robots.sitemaps, ["https://example.com/sitemap.xml"]);
});

test("prefers a matching user agent group over wildcard rules", () => {
  const robots = parseRobots(
    `
User-agent: *
Disallow: /

User-agent: WebsiteMigrationTool
Allow: /
`,
    "WebsiteMigrationTool/1.0",
    "https://example.com/"
  );

  assert.equal(robots.isAllowed("https://example.com/about"), true);
});

test("deny-all robots policy blocks every URL", () => {
  const { denyAllRobots } = require("../src/robots");
  const robots = denyAllRobots();

  assert.equal(robots.blocked, true);
  assert.equal(robots.isAllowed("https://example.com/"), false);
});
