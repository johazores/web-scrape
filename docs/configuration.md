# Configuration

Copy `.env.example` to `.env`. Empty optional values can be left unchanged.

## Required

| Variable | Description |
|---|---|
| `BASE_URL` | Root website URL to migrate. |

## Crawl limits

| Variable | Default | Description |
|---|---:|---|
| `MAX_PAGES` | `500` | Maximum page URLs attempted during one crawl. |
| `MAX_DEPTH` | `5` | Maximum internal-link depth from a seed URL. |
| `CONCURRENCY` | `2` | Maximum pages processed at the same time. |
| `REQUEST_TIMEOUT_MS` | `15000` | Request timeout in milliseconds. |
| `REQUEST_DELAY_MS` | `500` | Minimum delay between request starts. |
| `RETRY_ATTEMPTS` | `2` | Retry count for network errors and temporary HTTP failures. |
| `MAX_REDIRECTS` | `10` | Maximum redirects followed for one URL. |
| `MAX_SITEMAPS` | `50` | Maximum sitemap files processed. |

## Discovery and URL rules

| Variable | Default | Description |
|---|---|---|
| `USER_AGENT` | `WebsiteMigrationTool/1.0` | Request user agent and robots matching identity. |
| `RESPECT_ROBOTS` | `true` | Enforce applicable robots rules. |
| `DISCOVER_SITEMAPS` | `true` | Discover robots-declared and common sitemap locations. |
| `SITEMAP_URLS` | empty | Comma-separated explicit sitemap URLs. |
| `INCLUDE_URL_PATTERNS` | empty | Optional comma-separated wildcard allowlist. |
| `EXCLUDE_URL_PATTERNS` | common private and commerce paths | Comma-separated wildcard blocklist. |
| `ALLOWED_HOSTS` | base host | Additional internal hostnames, comma-separated. |
| `DROP_TRACKING_PARAMS` | `true` | Remove common analytics parameters such as `utm_*`. |
| `REMOVE_QUERY_PARAMS` | empty | Additional query parameter names to remove. |

Patterns can match a complete URL or a path and may contain `*`.

```env
INCLUDE_URL_PATTERNS=/blog/*,/services/*
EXCLUDE_URL_PATTERNS=/blog/preview/*,/services/private/*
```

## Output and recovery

| Variable | Default | Description |
|---|---|---|
| `OUTPUT_DIR` | `output` | Output directory. |
| `OUTPUT_FORMATS` | `json,markdown,csv` | Enabled export formats. |
| `RESUME` | `true` | Resume compatible state from `state.json`. |
| `RECRAWL_COMPLETED` | `false` | Clear completed page records and crawl again. |
| `DOWNLOAD_MEDIA` | `false` | Download referenced media into `media/files`. |
| `MAX_MEDIA_FILES` | `1000` | Maximum media downloads. |

Changing URL normalization or extraction settings creates a new crawl instead of applying incompatible state.

## Content extraction

| Variable | Default | Description |
|---|---|---|
| `CONTENT_SELECTORS` | common content containers | Ordered selectors used to find page content. |
| `EXCLUDE_SELECTORS` | scripts, navigation, footer, and common overlays | Elements removed from the content export. |

The first matching content selector is used. Add site-specific selectors when a theme has a clear main content container.

## Authentication

| Variable | Description |
|---|---|
| `COOKIE` | Raw request cookie header. |
| `AUTH_TYPE` | Empty, `basic`, or `bearer`. |
| `AUTH_USERNAME` | Basic authentication username. |
| `AUTH_PASSWORD` | Basic authentication password. |
| `AUTH_TOKEN` | Bearer token. |
| `EXTRA_HEADERS` | JSON object containing additional static request headers. |

Example:

```env
AUTH_TYPE=bearer
AUTH_TOKEN=replace-me
EXTRA_HEADERS={"X-Migration-Key":"replace-me"}
```

Do not commit `.env` files or credentials.

## JavaScript rendering

| Variable | Default | Description |
|---|---|---|
| `JS_RENDERING` | `false` | Use Playwright instead of normal HTTP for page HTML. |
| `JS_RENDER_WAIT_MS` | `0` | Extra wait after the page DOM is ready. |

Install Playwright only when the website requires it:

```bash
npm install --save-dev playwright
npx playwright install chromium
```
