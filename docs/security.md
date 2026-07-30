# Security Policy

## Reporting

Do not open a public issue for vulnerabilities involving credential leakage, external redirect handling, private content exposure, server-side request forgery, unsafe file paths, or browser automation.

Contact the maintainer through the GitHub profile with a sanitized reproduction, affected configuration, expected behavior, actual behavior, and potential impact.

## Security boundaries

The scraper processes remote content and may optionally use authentication, media downloads, and browser rendering. Operators are responsible for target authorization, credential handling, output storage, and applicable legal or privacy requirements.

## Safe operation

- Crawl only approved hosts.
- Use a dedicated account with minimum permissions.
- Keep credentials in local environment variables.
- Review redirects and allowed-host configuration.
- Treat generated exports and downloaded media as sensitive.
- Run browser rendering in an isolated environment when processing untrusted pages.
- Never commit `.env` files or generated output containing private content.
