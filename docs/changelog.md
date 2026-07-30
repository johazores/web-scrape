# Changelog

Notable changes to the website migration scraper are documented here.

## Unreleased

### Added

- MIT licensing and open-source contribution, security, roadmap, and repository documentation.

## 1.0.0

### Added

- Configurable website migration crawling.
- Sitemap and internal-link discovery.
- `robots.txt` support.
- Bounded concurrency, delays, retries, timeouts, and redirect tracking.
- Structured JSON and optional Markdown page exports.
- SEO, navigation, taxonomy, media, and JSON-LD extraction.
- Resume state, migration reports, and SEO reports.
- Optional media downloads and Playwright rendering.

### Security

- Restricted authentication to approved hosts.
- Blocked unsafe external redirects before requesting them.
- Added redirect-loop and browser request protections.
