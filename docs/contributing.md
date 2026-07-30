# Contributing

Thank you for helping improve the website migration scraper.

## Setup

```bash
npm install
npm test
npm run check
```

Use websites you own or are authorized to crawl. Tests and examples must not target unrelated public websites or include copied private content.

## Branches and commits

Use focused branches such as `feat/<feature-name>`, `fix/<issue-name>`, or `docs/<topic>`. Use Conventional Commits and keep each commit focused.

## Development principles

- Preserve responsible crawling defaults.
- Respect `robots.txt` unless the operator explicitly controls the target.
- Keep concurrency and request rates bounded.
- Do not send credentials to unapproved hosts.
- Keep the canonical page export stable and documented.
- Prefer filesystem workflows over infrastructure that is not required.
- Do not add or modify GitHub Actions without a separate workflow and cost review.

## Pull requests

Describe what changed, why it changed, testing performed, and any output-format or configuration compatibility concerns.
