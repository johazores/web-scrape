# Troubleshooting

## `BASE_URL is required`

Copy `.env.example` to `.env` and set an absolute HTTP or HTTPS URL.

## No pages were discovered

Check:

- `output/sitemap/discovered-sitemaps.json`
- `output/sitemap/robots.txt`
- Include and exclude patterns
- Whether the website requires authentication
- Whether content is rendered only through JavaScript

The crawler falls back to `BASE_URL` when no sitemap pages are available.

## Pages are skipped by robots.txt

This is expected when `RESPECT_ROBOTS=true`. Confirm that you have authorization and coordinate with the website owner before changing robots behavior.

The crawl stops when robots rules cannot be verified because of a server or network error. A missing `robots.txt` response with HTTP 404 or 410 is treated as no published restrictions.

## A page redirects to another domain

Cross-host redirects are stopped before the target is requested unless its hostname is listed in `ALLOWED_HOSTS`. This prevents accidental external crawling and credential leakage. Add only website aliases or trusted migration hosts that are intentionally part of the crawl.

## Content contains menus or missing article text

Set a more specific first value in `CONTENT_SELECTORS` and add unwanted elements to `EXCLUDE_SELECTORS`.

Example:

```env
CONTENT_SELECTORS=.article-body,main
EXCLUDE_SELECTORS=script,style,nav,footer,.newsletter-signup
```

## Crawl is too slow

First confirm the website can safely handle a faster crawl. Then reduce `REQUEST_DELAY_MS` or increase `CONCURRENCY` gradually.

## Requests time out

Increase `REQUEST_TIMEOUT_MS`, confirm network access, and inspect authentication or firewall requirements.

## JavaScript content is missing

Install Playwright, set `JS_RENDERING=true`, and optionally set `JS_RENDER_WAIT_MS` for delayed content.

## Resume starts a new crawl

The state fingerprint changes when URL normalization or extraction settings change. This prevents incompatible state from being mixed into a migration export.

## Two URLs need separate exports

Query strings are included in the normalized URL and receive a stable short hash in their output directory. Configure `REMOVE_QUERY_PARAMS` only for parameters that do not change page content.
