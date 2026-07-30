# Website Migration Scraper

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.18.1-brightgreen.svg)](package.json)
[![Version](https://img.shields.io/badge/version-1.0.0-informational.svg)](package.json)

A responsible Node.js crawler for website migrations, structured content exports, media discovery, and SEO preservation.

The project is designed for websites you own or are authorized to migrate. It is intentionally not a large-scale or general-purpose crawler.

> **Status:** Active open-source development. Review the target website's permissions, privacy requirements, copyright restrictions, and terms before collecting content.

## Features

- Reads configuration from `.env`
- Respects `robots.txt` by default
- Discovers sitemaps and sitemap indexes
- Falls back to bounded internal-link crawling
- Normalizes and deduplicates URLs
- Supports depth limits, page limits, include patterns, and exclude patterns
- Uses rate limiting, timeouts, retries, and bounded concurrency
- Restricts redirects and authentication to approved hosts
- Saves JSON and optional Markdown exports per page
- Extracts SEO data, content, headings, links, media, navigation, breadcrumbs, taxonomy, dates, authors, and JSON-LD
- Saves resumable crawl state
- Generates migration and SEO reports
- Optionally downloads media
- Optionally renders JavaScript pages with Playwright

## Requirements

- Node.js 20.18.1 or newer
- Permission to crawl and migrate the target website
- Sufficient local storage for exports and optional media

## Installation

```bash
npm install
cp .env.example .env
```

Set `BASE_URL`, then run:

```bash
npm run scrape
```

Generated files are written to `output/` by default.

## Configuration

```env
BASE_URL=https://example.com
MAX_PAGES=500
MAX_DEPTH=5
CONCURRENCY=2
REQUEST_DELAY_MS=500
RESPECT_ROBOTS=true
DISCOVER_SITEMAPS=true
OUTPUT_DIR=output
RESUME=true
DOWNLOAD_MEDIA=false
JS_RENDERING=false
```

See the [configuration guide](docs/configuration.md) for the complete reference.

## Output

```text
output/
  manifest.json
  state.json
  pages/
  media/
  seo/
  sitemap/
  reports/
```

Each page receives a stable export that can be transformed for WordPress, Next.js, Astro, Hugo, or a custom CMS.

## Architecture

The crawler uses small CommonJS modules and a filesystem-based workflow:

```text
scrape.js            command entry point
src/config.js        configuration loading and validation
src/http.js          requests, delays, retries, redirects, and authentication
src/robots.js        robots rules
src/sitemap.js       sitemap discovery
src/crawler.js       crawl orchestration
src/extract.js       canonical page extraction
src/output.js        JSON, Markdown, CSV, and text output
src/state.js         resumable state
src/report.js        migration and SEO reports
src/media.js         optional media downloads
src/render.js        optional Playwright rendering
```

Read the [architecture guide](docs/architecture.md) for design decisions and crawl flow.

## Migration workflow

1. Confirm ownership or migration authorization.
2. Configure allowed hosts, limits, delays, and output options.
3. Run a small crawl and review the canonical exports.
4. Adjust extraction or transformation rules for the destination CMS.
5. Run the full crawl with resumable state enabled.
6. Review redirects, missing metadata, media, failures, and SEO reports.
7. Import transformed output into the destination system.
8. Verify URLs, content, metadata, media, and redirects before launch.

See [migration workflow](docs/migration-workflow.md) for details.

## Responsible use

Only crawl websites you own or are authorized to migrate.

- Keep `RESPECT_ROBOTS=true` unless you control the target and have a documented reason.
- Use conservative concurrency and delays.
- Do not bypass authentication, access controls, or anti-bot protections.
- Do not publish private exports or credentials.
- Treat downloaded content and media according to their licenses and legal restrictions.

Read [responsible use and limitations](docs/responsible-use.md).

## Testing

```bash
npm test
npm run check
```

Tests should use local fixtures or approved test websites. Do not use unrelated public websites as automated test targets.

## Documentation

- [Documentation index](docs/index.md)
- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Migration workflow](docs/migration-workflow.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Responsible use](docs/responsible-use.md)
- [Roadmap](docs/roadmap.md)
- [Changelog](docs/changelog.md)
- [Contributing](docs/contributing.md)
- [Security policy](docs/security.md)
- [Code of conduct](docs/code-of-conduct.md)

## License

MIT. See [LICENSE](LICENSE).

## Author

Created and maintained by [Johanssen Azores](https://github.com/johazores).
