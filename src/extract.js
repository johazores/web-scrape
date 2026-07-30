const cheerio = require("cheerio");
const { isInternalUrl, isMediaUrl, normalizeUrl, safeUrl } = require("./url");

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueBy(items, keyFactory) {
  const seen = new Set();

  return items.filter((item) => {
    const key = keyFactory(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function resolveUrl(value, pageUrl) {
  return safeUrl(value, pageUrl)?.href || null;
}

function getMeta($, selector, attribute = "content") {
  return cleanText($(selector).first().attr(attribute) || "");
}

function getMetaMap($, selector, nameAttribute) {
  const values = {};

  $(selector).each((_, element) => {
    const key = $(element).attr(nameAttribute);
    const value = cleanText($(element).attr("content") || "");

    if (!key || !value) {
      return;
    }

    values[key] = value;
  });

  return values;
}

function parseJsonLd($) {
  const records = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html()?.trim();

    if (!raw) {
      return;
    }

    try {
      records.push({ parsed: JSON.parse(raw), raw: null, error: null });
    } catch (error) {
      records.push({ parsed: null, raw, error: error.message });
    }
  });

  return records;
}

function flattenStructuredData(records) {
  const values = [];

  for (const record of records) {
    if (!record.parsed) {
      continue;
    }

    const items = Array.isArray(record.parsed) ? record.parsed : [record.parsed];

    for (const item of items) {
      if (item?.["@graph"] && Array.isArray(item["@graph"])) {
        values.push(...item["@graph"]);
      } else {
        values.push(item);
      }
    }
  }

  return values;
}

function findStructuredValue(items, keys) {
  for (const item of items) {
    for (const key of keys) {
      const value = item?.[key];

      if (typeof value === "string" && cleanText(value)) {
        return cleanText(value);
      }

      if (value && typeof value === "object" && typeof value.name === "string") {
        return cleanText(value.name);
      }
    }
  }

  return "";
}

function extractHeadings($) {
  const headings = [];

  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    headings.push({
      level: Number.parseInt(element.tagName.slice(1), 10),
      text: cleanText($(element).text()),
      id: $(element).attr("id") || null,
    });
  });

  return headings.filter((heading) => heading.text);
}

function extractImages($, pageUrl) {
  const images = [];

  $("img").each((_, element) => {
    const image = $(element);
    const source =
      image.attr("src") ||
      image.attr("data-src") ||
      image.attr("data-lazy-src") ||
      image.attr("data-original");
    const resolvedSource = resolveUrl(source, pageUrl);

    if (!resolvedSource) {
      return;
    }

    const sourceSet = (image.attr("srcset") || image.attr("data-srcset") || "")
      .split(",")
      .map((candidate) => candidate.trim().split(/\s+/)[0])
      .map((candidate) => resolveUrl(candidate, pageUrl))
      .filter(Boolean);
    const figure = image.closest("figure");

    images.push({
      url: resolvedSource,
      alt: cleanText(image.attr("alt") || ""),
      title: cleanText(image.attr("title") || ""),
      width: image.attr("width") || null,
      height: image.attr("height") || null,
      caption: cleanText(figure.find("figcaption").first().text()),
      srcset: [...new Set(sourceSet)],
    });
  });

  return uniqueBy(images, (image) => image.url);
}

function extractLinks($, pageUrl, config) {
  const internal = [];
  const external = [];
  const media = [];

  $("a[href]").each((_, element) => {
    const anchor = $(element);
    const resolved = resolveUrl(anchor.attr("href"), pageUrl);

    if (!resolved) {
      return;
    }

    const normalized = normalizeUrl(resolved, pageUrl, config) || resolved;
    const record = {
      url: normalized,
      text: cleanText(anchor.text()),
      title: cleanText(anchor.attr("title") || ""),
      rel: (anchor.attr("rel") || "").split(/\s+/).filter(Boolean),
    };

    if (isMediaUrl(normalized)) {
      media.push({
        type: "document",
        ...record,
      });
    }

    if (isInternalUrl(normalized, config)) {
      internal.push(record);
    } else {
      external.push(record);
    }
  });

  return {
    internal: uniqueBy(internal, (link) => link.url),
    external: uniqueBy(external, (link) => link.url),
    media: uniqueBy(media, (link) => link.url),
  };
}

function extractEmbeddedMedia($, pageUrl) {
  const media = [];

  $("video, audio, source").each((_, element) => {
    const node = $(element);
    const source = resolveUrl(node.attr("src"), pageUrl);

    if (!source) {
      return;
    }

    media.push({
      type: element.tagName === "audio" ? "audio" : "video",
      url: source,
      mimeType: node.attr("type") || null,
    });
  });

  return uniqueBy(media, (item) => item.url);
}

function extractBreadcrumbs($, pageUrl) {
  const selectors = [
    'nav[aria-label*="breadcrumb" i]',
    ".breadcrumbs",
    ".breadcrumb",
    '[itemtype*="BreadcrumbList"]',
  ];

  for (const selector of selectors) {
    const root = $(selector).first();

    if (!root.length) {
      continue;
    }

    const items = [];

    root.find("a, [aria-current], li, span").each((_, element) => {
      const node = $(element);
      const text = cleanText(node.text());

      if (!text) {
        return;
      }

      items.push({
        text,
        url: resolveUrl(node.attr("href"), pageUrl),
      });
    });

    return uniqueBy(items, (item) => `${item.text}|${item.url || ""}`);
  }

  return [];
}

function extractNavigation($, pageUrl) {
  const navigation = [];

  $("nav").each((index, element) => {
    const node = $(element);
    const links = [];

    node.find("a[href]").each((_, anchorElement) => {
      const anchor = $(anchorElement);
      const url = resolveUrl(anchor.attr("href"), pageUrl);
      const text = cleanText(anchor.text());

      if (url && text) {
        links.push({ url, text });
      }
    });

    if (links.length > 0) {
      navigation.push({
        label:
          cleanText(node.attr("aria-label") || "") ||
          cleanText(node.find("h1, h2, h3").first().text()) ||
          `navigation-${index + 1}`,
        links: uniqueBy(links, (link) => `${link.text}|${link.url}`),
      });
    }
  });

  return navigation;
}

function extractTaxonomy($, structuredItems) {
  const categories = [];
  const tags = [];

  $('a[rel~="category"], .category a, .categories a').each((_, element) => {
    const value = cleanText($(element).text());
    if (value) categories.push(value);
  });

  $('a[rel~="tag"], .tag a, .tags a').each((_, element) => {
    const value = cleanText($(element).text());
    if (value) tags.push(value);
  });

  const section = getMeta($, 'meta[property="article:section"]');
  if (section) categories.push(section);

  for (const item of structuredItems) {
    const keywords = item?.keywords;
    const sectionValue = item?.articleSection;

    if (Array.isArray(keywords)) {
      tags.push(...keywords.map(cleanText));
    } else if (typeof keywords === "string") {
      tags.push(...keywords.split(",").map(cleanText));
    }

    if (Array.isArray(sectionValue)) {
      categories.push(...sectionValue.map(cleanText));
    } else if (typeof sectionValue === "string") {
      categories.push(cleanText(sectionValue));
    }
  }

  return {
    categories: [...new Set(categories.filter(Boolean))],
    tags: [...new Set(tags.filter(Boolean))],
  };
}

function selectContent($, config) {
  for (const selector of config.contentSelectors) {
    const node = $(selector).first();

    if (node.length) {
      return { selector, html: node.html() || "" };
    }
  }

  return { selector: "body", html: $("body").html() || "" };
}

function htmlToMarkdown(html) {
  const fragment = cheerio.load(`<body>${html}</body>`);
  const $ = fragment;

  $("br").replaceWith("\n");
  $("hr").replaceWith("\n---\n");

  for (let level = 1; level <= 6; level += 1) {
    $(`h${level}`).each((_, element) => {
      $(element).replaceWith(`\n${"#".repeat(level)} ${cleanText($(element).text())}\n`);
    });
  }

  $("li").each((_, element) => {
    $(element).replaceWith(`\n- ${cleanText($(element).text())}`);
  });

  $("a").each((_, element) => {
    const node = $(element);
    const text = cleanText(node.text());
    const href = node.attr("href");
    node.replaceWith(href ? `[${text || href}](${href})` : text);
  });

  $("strong, b").each((_, element) => {
    $(element).replaceWith(`**${cleanText($(element).text())}**`);
  });

  $("em, i").each((_, element) => {
    $(element).replaceWith(`*${cleanText($(element).text())}*`);
  });

  $("p, div, section, article, blockquote, table, tr").each((_, element) => {
    $(element).append("\n\n");
  });

  return $("body")
    .text()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPage(html, response, config) {
  const $ = cheerio.load(html);
  const structuredData = parseJsonLd($);
  const structuredItems = flattenStructuredData(structuredData);
  const headings = extractHeadings($);
  const links = extractLinks($, response.finalUrl, config);
  const images = extractImages($, response.finalUrl);
  const embeddedMedia = extractEmbeddedMedia($, response.finalUrl);
  const selectedContent = selectContent($, config);
  const contentFragment = cheerio.load(`<body>${selectedContent.html}</body>`);

  for (const selector of config.excludeSelectors) {
    contentFragment(selector).remove();
  }

  const cleanedHtml = contentFragment("body").html()?.trim() || "";
  const canonicalValue = getMeta($, 'link[rel="canonical"]', "href");
  const canonical = canonicalValue
    ? normalizeUrl(canonicalValue, response.finalUrl, config)
    : null;
  const published =
    getMeta($, 'meta[property="article:published_time"]') ||
    getMeta($, 'meta[name="date"]') ||
    getMeta($, "time[datetime]", "datetime") ||
    findStructuredValue(structuredItems, ["datePublished"]);
  const modified =
    getMeta($, 'meta[property="article:modified_time"]') ||
    findStructuredValue(structuredItems, ["dateModified"]);
  const author =
    getMeta($, 'meta[name="author"]') ||
    cleanText($('a[rel="author"]').first().text()) ||
    findStructuredValue(structuredItems, ["author", "creator"]);
  const taxonomy = extractTaxonomy($, structuredItems);

  return {
    schemaVersion: 1,
    id: null,
    source: {
      requestedUrl: response.requestedUrl,
      finalUrl: response.finalUrl,
      normalizedUrl: normalizeUrl(response.finalUrl, config.baseUrl, config),
      status: response.status,
      contentType: response.headers["content-type"] || null,
      redirects: response.redirects,
      durationMs: response.durationMs,
      crawledAt: new Date().toISOString(),
    },
    title: cleanText($("title").first().text()),
    seo: {
      title: cleanText($("title").first().text()),
      description: getMeta($, 'meta[name="description"]'),
      canonical,
      robots: getMeta($, 'meta[name="robots"]')
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      openGraph: getMetaMap($, 'meta[property^="og:"]', "property"),
      twitter: getMetaMap($, 'meta[name^="twitter:"]', "name"),
    },
    language:
      cleanText($("html").attr("lang") || "") ||
      getMeta($, 'meta[http-equiv="content-language"]'),
    headings,
    content: {
      selector: selectedContent.selector,
      html: cleanedHtml,
      text: cleanText(contentFragment("body").text()),
      markdown: htmlToMarkdown(cleanedHtml),
    },
    images,
    media: uniqueBy(
      [
        ...images.map((image) => ({ type: "image", ...image })),
        ...embeddedMedia,
        ...links.media,
      ],
      (item) => item.url
    ),
    links: {
      internal: links.internal,
      external: links.external,
    },
    breadcrumbs: extractBreadcrumbs($, response.finalUrl),
    navigation: extractNavigation($, response.finalUrl),
    taxonomy,
    structuredData,
    author: author || null,
    dates: {
      published: published || null,
      modified: modified || null,
    },
  };
}

module.exports = {
  cleanText,
  extractPage,
  htmlToMarkdown,
  parseJsonLd,
  resolveUrl,
};
