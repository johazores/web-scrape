const path = require("path");
const { extractPage } = require("./extract");
const { createHttpClient } = require("./http");
const { downloadMediaForPage } = require("./media");
const {
  initializeOutput,
  writeJson,
  writePage,
  writeText,
} = require("./output");
const { createReports, writeReports } = require("./report");
const { createRenderer } = require("./render");
const { allowAllRobots, parseRobots } = require("./robots");
const { discoverSitemaps } = require("./sitemap");
const { loadState, saveState } = require("./state");
const { isCrawlableUrl, normalizeUrl, shortHash } = require("./url");

function addToQueue(state, item, config) {
  const normalized = normalizeUrl(item.url, config.baseUrl, config);

  if (!normalized || !isCrawlableUrl(normalized, config)) {
    return false;
  }

  if (item.depth > config.maxDepth) {
    return false;
  }

  if (state.visited[normalized] || state.queued.includes(normalized)) {
    return false;
  }

  state.queue.push({
    url: normalized,
    depth: item.depth,
    source: item.source,
    referrer: item.referrer || null,
  });
  state.queued.push(normalized);
  return true;
}

function removeFromQueued(state, url) {
  state.queued = state.queued.filter((queuedUrl) => queuedUrl !== url);
}

async function loadRobots(http, config, directories) {
  if (!config.respectRobots) {
    return allowAllRobots();
  }

  const robotsUrl = `${config.baseOrigin}/robots.txt`;

  try {
    const response = await http.get(robotsUrl, {
      headers: { Accept: "text/plain,*/*;q=0.8" },
    });

    if (response.status < 200 || response.status >= 300) {
      return allowAllRobots();
    }

    writeText(path.join(directories.sitemap, "robots.txt"), String(response.data));
    return parseRobots(response.data, config.userAgent, config.baseUrl);
  } catch (error) {
    console.warn(`Unable to read robots.txt: ${error.message}`);
    return allowAllRobots();
  }
}

function isHtmlResponse(response) {
  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  return !contentType || contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
}

function recordFailure(state, item, error, status = null) {
  const failure = {
    url: item.url,
    depth: item.depth,
    status,
    error: error.message || String(error),
    failedAt: new Date().toISOString(),
  };

  state.failures = state.failures.filter((existing) => existing.url !== item.url);
  state.failures.push(failure);
  state.visited[item.url] = {
    status,
    result: "failed",
    visitedAt: failure.failedAt,
  };
}

async function processPage(item, context) {
  const { config, directories, fetcher, http, robots, state } = context;

  if (config.respectRobots && !robots.isAllowed(item.url)) {
    state.skipped.push({
      url: item.url,
      depth: item.depth,
      reason: "robots.txt",
    });
    state.visited[item.url] = {
      status: null,
      result: "skipped",
      visitedAt: new Date().toISOString(),
    };
    return [];
  }

  try {
    console.log(`Scraping [depth ${item.depth}]: ${item.url}`);
    const response = await fetcher.get(item.url);

    if (response.status < 200 || response.status >= 300) {
      throw Object.assign(new Error(`HTTP ${response.status}`), {
        status: response.status,
      });
    }

    if (!isHtmlResponse(response)) {
      state.skipped.push({
        url: item.url,
        depth: item.depth,
        status: response.status,
        reason: `non-html content: ${response.headers["content-type"] || "unknown"}`,
      });
      state.visited[item.url] = {
        status: response.status,
        result: "skipped",
        visitedAt: new Date().toISOString(),
      };
      return [];
    }

    const page = extractPage(response.data, response, config);
    page.id = shortHash(page.source.normalizedUrl, 16);

    await downloadMediaForPage(page, {
      config,
      directories,
      http,
      state,
    });

    const files = writePage(page, directories, config);
    const summary = {
      url: page.source.normalizedUrl,
      finalUrl: page.source.finalUrl,
      status: page.source.status,
      title: page.seo.title,
      description: page.seo.description,
      canonical: page.seo.canonical,
      h1Count: page.headings.filter((heading) => heading.level === 1).length,
      redirects: page.source.redirects,
      internalLinks: page.links.internal.map((link) => link.url),
      file: files.json || files.markdown || null,
    };

    state.pages[item.url] = summary;
    state.failures = state.failures.filter((failure) => failure.url !== item.url);
    state.visited[item.url] = {
      status: response.status,
      result: "success",
      finalUrl: response.finalUrl,
      visitedAt: new Date().toISOString(),
    };

    return page.links.internal.map((link) => link.url);
  } catch (error) {
    recordFailure(state, item, error, error.status || null);
    console.error(`Failed: ${item.url} (${error.message})`);
    return [];
  }
}

async function runCrawl(config) {
  const directories = initializeOutput(config);
  const state = loadState(config);
  state.baseUrl = normalizeUrl(config.baseUrl, config.baseUrl, config);

  if (config.recrawlCompleted) {
    state.queue = [];
    state.queued = [];
    state.visited = {};
    state.pages = {};
    state.failures = [];
    state.skipped = [];
  }

  const initialHttp = createHttpClient(config);
  const robots = await loadRobots(initialHttp, config, directories);
  const effectiveDelayMs = Math.max(
    config.requestDelayMs,
    robots.crawlDelay === null ? 0 : Math.ceil(robots.crawlDelay * 1000)
  );
  const effectiveConfig = {
    ...config,
    requestDelayMs: effectiveDelayMs,
  };

  if (effectiveDelayMs > config.requestDelayMs) {
    console.log(`Using robots.txt crawl delay: ${effectiveDelayMs}ms`);
  }

  const http = createHttpClient(effectiveConfig);
  const sitemapDiscovery = await discoverSitemaps(http, effectiveConfig, robots.sitemaps);
  state.sitemapPages = sitemapDiscovery.pages.filter((url) =>
    isCrawlableUrl(url, effectiveConfig)
  );
  state.sitemapRecords = sitemapDiscovery.records;

  writeJson(
    path.join(directories.sitemap, "discovered-sitemaps.json"),
    sitemapDiscovery.records
  );
  writeJson(
    path.join(directories.sitemap, "discovered-urls.json"),
    sitemapDiscovery.pages
  );

  if (state.queue.length === 0) {
    const seeds = sitemapDiscovery.pages.length > 0
      ? sitemapDiscovery.pages.map((url) => ({ url, source: "sitemap" }))
      : [{ url: config.baseUrl, source: "base-url" }];

    for (const seed of seeds) {
      addToQueue(
        state,
        {
          url: seed.url,
          depth: 0,
          source: seed.source,
          referrer: null,
        },
        effectiveConfig
      );
    }
  }

  let renderer = null;
  const fetcher = effectiveConfig.jsRendering
    ? (renderer = await createRenderer(effectiveConfig))
    : http;

  try {
    while (
      state.queue.length > 0 &&
      Object.keys(state.visited).length < effectiveConfig.maxPages
    ) {
      const remainingCapacity =
        effectiveConfig.maxPages - Object.keys(state.visited).length;
      const batchSize = Math.min(
        effectiveConfig.concurrency,
        remainingCapacity,
        state.queue.length
      );
      const batch = state.queue.splice(0, batchSize);

      for (const item of batch) {
        removeFromQueued(state, item.url);
      }

      const results = await Promise.all(
        batch.map((item) =>
          processPage(item, {
            config: effectiveConfig,
            directories,
            fetcher,
            http,
            robots,
            state,
          }).then((links) => ({ item, links }))
        )
      );

      for (const { item, links } of results) {
        for (const link of links) {
          addToQueue(
            state,
            {
              url: link,
              depth: item.depth + 1,
              source: "internal-link",
              referrer: item.url,
            },
            effectiveConfig
          );
        }
      }

      saveState(config, state);
    }
  } finally {
    if (renderer) {
      await renderer.close();
    }
  }

  state.completedAt = new Date().toISOString();
  saveState(config, state);

  writeJson(path.join(directories.media, "manifest.json"), Object.values(state.media));
  writeJson(path.join(config.outputDir, "manifest.json"), {
    schemaVersion: 1,
    baseUrl: config.baseUrl,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    pageCount: Object.keys(state.pages).length,
    failedCount: state.failures.length,
    skippedCount: state.skipped.length,
    mediaCount: Object.keys(state.media).length,
    outputFormats: [...config.outputFormats],
  });

  const reports = createReports(state);
  writeReports(reports, directories, config);
  writeJson(path.join(directories.seo, "pages.json"), reports.successfulPages);

  return {
    ...reports.summary,
    reportsDirectory: directories.reports,
  };
}

module.exports = {
  addToQueue,
  isHtmlResponse,
  loadRobots,
  processPage,
  runCrawl,
};
