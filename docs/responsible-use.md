# Responsible use and known limitations

## Responsible use

Use this project only for websites you own or have explicit permission to migrate, archive, or back up.

Before crawling:

- Confirm ownership or written authorization.
- Review the website terms and applicable laws.
- Identify personal, confidential, copyrighted, or regulated content.
- Use conservative request limits.
- Respect `robots.txt` unless the website owner has explicitly approved a different migration process.
- Store credentials and exports securely.
- Delete temporary exports when they are no longer needed.

The project does not include proxy rotation, CAPTCHA bypass, anti-bot evasion, credential discovery, or other mechanisms intended to avoid website controls.

## Known limitations

- Robots parsing covers common `Allow`, `Disallow`, wildcard, end-anchor, sitemap, and crawl-delay directives but is not a full RFC implementation.
- Orphan-page detection is approximate and depends on sitemap coverage and visible internal links.
- Categories, tags, author, dates, navigation, and breadcrumbs depend on available HTML or structured metadata.
- JavaScript redirects are not recorded as full HTTP redirect chains when Playwright rendering is enabled.
- Form-based login automation is not included.
- Media downloads preserve source files but do not rewrite HTML automatically.
- Very large sites may require a database-backed queue, which is intentionally outside this project's scope.
