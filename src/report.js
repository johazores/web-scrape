const path = require("path");
const { writeCsv, writeJson } = require("./output");

function groupDuplicates(pages, field) {
  const values = new Map();

  for (const page of pages) {
    const value = String(page[field] || "").trim().toLowerCase();

    if (!value) {
      continue;
    }

    if (!values.has(value)) {
      values.set(value, []);
    }

    values.get(value).push(page.url);
  }

  return [...values.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([value, urls]) => ({ value, urls }));
}

function createReports(state) {
  const pages = Object.values(state.pages);
  const failedUrls = new Set(state.failures.map((failure) => failure.url));
  const visitedStatuses = new Map(
    Object.entries(state.visited).map(([url, record]) => [url, record.status])
  );
  const inboundCounts = new Map();
  const brokenInternalLinks = [];

  for (const page of pages) {
    for (const targetUrl of page.internalLinks || []) {
      inboundCounts.set(targetUrl, (inboundCounts.get(targetUrl) || 0) + 1);
      const status = visitedStatuses.get(targetUrl);

      if (failedUrls.has(targetUrl) || (status && status >= 400)) {
        brokenInternalLinks.push({
          sourceUrl: page.url,
          targetUrl,
          status: status || null,
        });
      }
    }
  }

  const redirects = pages
    .filter((page) => page.redirects?.length)
    .map((page) => ({
      url: page.url,
      finalUrl: page.finalUrl,
      chain: page.redirects,
    }));
  const missingTitles = pages.filter((page) => !page.title).map((page) => page.url);
  const missingDescriptions = pages
    .filter((page) => !page.description)
    .map((page) => page.url);
  const missingH1 = pages.filter((page) => page.h1Count === 0).map((page) => page.url);
  const orphanPages = state.sitemapPages.filter(
    (url) => url !== state.baseUrl && !inboundCounts.get(url)
  );
  const duplicateTitles = groupDuplicates(pages, "title");
  const duplicateDescriptions = groupDuplicates(pages, "description");

  return {
    summary: {
      baseUrl: state.baseUrl,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      successfulPages: pages.length,
      failedPages: state.failures.length,
      skippedPages: state.skipped.length,
      redirectingPages: redirects.length,
      brokenInternalLinks: brokenInternalLinks.length,
      missingTitles: missingTitles.length,
      missingDescriptions: missingDescriptions.length,
      duplicateTitles: duplicateTitles.length,
      duplicateDescriptions: duplicateDescriptions.length,
      missingH1: missingH1.length,
      orphanPages: orphanPages.length,
    },
    successfulPages: pages,
    failedPages: state.failures,
    skippedPages: state.skipped,
    redirects,
    brokenInternalLinks,
    missingTitles,
    missingDescriptions,
    duplicateTitles,
    duplicateDescriptions,
    missingH1,
    orphanPages,
  };
}

function writeReports(reports, directories, config) {
  const entries = {
    "summary.json": reports.summary,
    "successful-pages.json": reports.successfulPages,
    "failed-pages.json": reports.failedPages,
    "skipped-pages.json": reports.skippedPages,
    "redirects.json": reports.redirects,
    "broken-internal-links.json": reports.brokenInternalLinks,
    "missing-titles.json": reports.missingTitles,
    "missing-meta-descriptions.json": reports.missingDescriptions,
    "duplicate-titles.json": reports.duplicateTitles,
    "duplicate-meta-descriptions.json": reports.duplicateDescriptions,
    "missing-h1.json": reports.missingH1,
    "orphan-pages.json": reports.orphanPages,
  };

  for (const [fileName, value] of Object.entries(entries)) {
    writeJson(path.join(directories.reports, fileName), value);
  }

  if (config.outputFormats.has("csv")) {
    writeCsv(
      path.join(directories.seo, "pages.csv"),
      reports.successfulPages,
      [
        "url",
        "finalUrl",
        "status",
        "title",
        "description",
        "canonical",
        "h1Count",
        "file",
      ]
    );

    writeCsv(
      path.join(directories.reports, "failed-pages.csv"),
      reports.failedPages,
      ["url", "depth", "status", "error"]
    );
  }
}

module.exports = {
  createReports,
  groupDuplicates,
  writeReports,
};
