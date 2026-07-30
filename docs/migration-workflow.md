# Example migration workflow

## 1. Confirm permission and scope

Document the source domain, target platform, included sections, excluded private areas, expected page count, and media requirements.

## 2. Configure a safe first crawl

Start with a low page limit and no media downloads:

```env
BASE_URL=https://example.com
MAX_PAGES=25
CONCURRENCY=1
REQUEST_DELAY_MS=1000
DOWNLOAD_MEDIA=false
```

Run `npm run scrape`, then inspect:

- `output/pages/`
- `output/reports/summary.json`
- `output/reports/failed-pages.json`
- `output/sitemap/discovered-urls.json`

## 3. Tune content selectors

Open a few page exports and verify that `content.html` contains the article or page body without menus, cookie notices, or footers.

Adjust `CONTENT_SELECTORS` and `EXCLUDE_SELECTORS` when needed.

## 4. Run the full crawl

Increase `MAX_PAGES`, set the final URL filters, and enable media downloads only when required.

Interrupted crawls can continue from `output/state.json` when `RESUME=true`.

## 5. Review migration reports

Resolve or record:

- Failed pages
- Redirect chains
- Broken internal links
- Missing titles or descriptions
- Duplicate titles or descriptions
- Missing H1 headings
- Approximate orphan pages

## 6. Transform the canonical export

Build a small importer that reads each `index.json` and maps it into the target platform.

### WordPress

Map page title, cleaned HTML, excerpt or meta description, taxonomy, author, publication date, featured image, slug, and SEO fields into the WordPress REST API or an import format.

### Next.js, Astro, or Hugo

Use `index.md` directly or transform `index.json` into Markdown or MDX frontmatter. Copy downloaded media into the target public or asset directory and rewrite URLs through the media manifest.

### Custom CMS

Use `schemaVersion` to validate the export before mapping fields into the CMS API or database.

## 7. Preserve redirects

Compare each source URL, final URL, canonical URL, and destination route. Create a redirect map before switching domains or replacing the existing site.

## 8. Validate the new site

Crawl the new platform and compare page counts, titles, canonical URLs, headings, internal links, structured data, and media availability against the source reports.
