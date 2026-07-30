const xml2js = require("xml2js");
const { normalizeUrl } = require("./url");

async function parseSitemap(xml) {
  const parsed = await xml2js.parseStringPromise(xml, {
    explicitArray: true,
    trim: true,
  });

  if (parsed.sitemapindex?.sitemap) {
    return {
      type: "index",
      urls: parsed.sitemapindex.sitemap
        .map((item) => item.loc?.[0])
        .filter(Boolean),
    };
  }

  if (parsed.urlset?.url) {
    return {
      type: "urlset",
      urls: parsed.urlset.url
        .map((item) => item.loc?.[0])
        .filter(Boolean),
    };
  }

  throw new Error("Unsupported sitemap format.");
}

async function discoverSitemaps(http, config, robotsSitemaps = []) {
  if (!config.discoverSitemaps) {
    return { pages: [], records: [] };
  }

  const candidates = [
    ...config.sitemapUrls,
    ...robotsSitemaps,
    `${config.baseOrigin}/sitemap.xml`,
    `${config.baseOrigin}/sitemap_index.xml`,
  ];
  const pending = [...new Set(candidates)];
  const seenSitemaps = new Set();
  const pageUrls = new Set();
  const records = [];

  while (pending.length > 0 && seenSitemaps.size < config.maxSitemaps) {
    const sitemapUrl = pending.shift();

    if (seenSitemaps.has(sitemapUrl)) {
      continue;
    }

    seenSitemaps.add(sitemapUrl);

    try {
      const response = await http.get(sitemapUrl, {
        headers: {
          Accept: "application/xml,text/xml,*/*;q=0.8",
        },
      });

      if (response.status < 200 || response.status >= 300) {
        records.push({
          url: sitemapUrl,
          status: response.status,
          type: "failed",
          count: 0,
        });
        continue;
      }

      const parsed = await parseSitemap(response.data);
      records.push({
        url: sitemapUrl,
        finalUrl: response.finalUrl,
        status: response.status,
        type: parsed.type,
        count: parsed.urls.length,
      });

      if (parsed.type === "index") {
        for (const childUrl of parsed.urls) {
          try {
            pending.push(new URL(childUrl, response.finalUrl).href);
          } catch {
            // Ignore malformed child sitemap URLs.
          }
        }
      } else {
        for (const pageUrl of parsed.urls) {
          const normalized = normalizeUrl(pageUrl, config.baseUrl, config);

          if (normalized) {
            pageUrls.add(normalized);
          }
        }
      }
    } catch (error) {
      records.push({
        url: sitemapUrl,
        status: null,
        type: "failed",
        count: 0,
        error: error.message,
      });
    }
  }

  return {
    pages: [...pageUrls],
    records,
  };
}

module.exports = {
  discoverSitemaps,
  parseSitemap,
};
