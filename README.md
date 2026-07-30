# Website Migration Scraper

A simple, responsible website migration tool for collecting content, SEO metadata, links, media references, navigation, taxonomy, and structured data from websites you own or have permission to migrate.

This project is intentionally not a large-scale or general-purpose crawler. It is designed for controlled website migrations, backups, archival work, and SEO preservation.

## Features

- Reads configuration from `.env`
- Respects `robots.txt` by default
- Discovers sitemaps from `robots.txt` and common locations
- Supports sitemap indexes and internal-link fallback crawling
- Normalizes and deduplicates URLs
- Applies crawl limits, depth limits, include patterns, and exclude patterns
- Uses rate limiting, timeouts, retries, and bounded concurrency
- Tracks redirects and final URLs
- Saves one JSON and optional Markdown export per page
- Extracts SEO, content, headings, links, media, navigation, breadcrumbs, taxonomy, dates, authors, and JSON-LD
- Saves checkpoint state and resumes interrupted crawls
- Generates migration and SEO reports
- Optionally downloads referenced media
- Optionally renders JavaScript pages with Playwright

## Requirements

- Node.js 20.18.1 or newer
- Permission to crawl and migrate the target website

## Installation

```bash
npm install
cp .env.example .env
```

Set `BASE_URL` in `.env`, then run:

```bash
npm run scrape
```

Generated files are saved to `output/` by default.

## Common configuration

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

See [Configuration](docs/configuration.md) for the complete environment variable reference.

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

Each page has its own directory and export, making the output easy to transform for WordPress, Next.js, Astro, Hugo, or a custom CMS.

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Migration workflow](docs/migration-workflow.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Responsible use and limitations](docs/responsible-use.md)

## Testing

```bash
npm test
npm run check
```

## Responsible use

Only crawl websites you own or are authorized to migrate. The crawler respects `robots.txt` and uses a request delay by default. Review the target website terms, privacy requirements, copyright restrictions, and applicable laws before collecting or storing content.
