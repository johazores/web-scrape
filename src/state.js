const fs = require("fs");
const path = require("path");
const { shortHash } = require("./url");
const { writeJson } = require("./output");

function getConfigFingerprint(config) {
  return shortHash(
    JSON.stringify({
      baseUrl: config.baseUrl,
      maxDepth: config.maxDepth,
      includePatterns: config.includePatterns,
      excludePatterns: config.excludePatterns,
      removeQueryParams: config.removeQueryParams,
      dropTrackingParams: config.dropTrackingParams,
      jsRendering: config.jsRendering,
    }),
    16
  );
}

function createState(config) {
  const now = new Date().toISOString();

  return {
    version: 1,
    configFingerprint: getConfigFingerprint(config),
    baseUrl: config.baseUrl,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    queue: [],
    queued: [],
    visited: {},
    pages: {},
    failures: [],
    skipped: [],
    sitemapPages: [],
    sitemapRecords: [],
    media: {},
  };
}

function loadState(config) {
  const statePath = path.join(config.outputDir, "state.json");

  if (!config.resume || !fs.existsSync(statePath)) {
    return createState(config);
  }

  let state;

  try {
    state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (error) {
    console.warn(`Existing crawl state is invalid and will be ignored: ${error.message}`);
    return createState(config);
  }

  const expectedFingerprint = getConfigFingerprint(config);

  if (state.configFingerprint !== expectedFingerprint) {
    console.warn("Existing crawl state uses different URL or extraction settings. Starting a new crawl.");
    return createState(config);
  }

  state.completedAt = null;
  state.queue ||= [];
  state.queued ||= state.queue.map((item) => item.url);
  state.visited ||= {};
  state.pages ||= {};
  state.failures ||= [];
  state.skipped ||= [];
  state.sitemapPages ||= [];
  state.sitemapRecords ||= [];
  state.media ||= {};

  return state;
}

function saveState(config, state) {
  state.updatedAt = new Date().toISOString();
  writeJson(path.join(config.outputDir, "state.json"), state);
}

module.exports = {
  createState,
  getConfigFingerprint,
  loadState,
  saveState,
};
