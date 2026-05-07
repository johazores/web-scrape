const axios = require("axios");
const cheerio = require("cheerio");
const xml2js = require("xml2js");
const slugify = require("slugify");
const fs = require("fs");
const path = require("path");

const SITE_URL = "https://cdawi.com";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

const outputDir = path.join(__dirname, "scraped-site");
const pagesDir = path.join(outputDir, "pages");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function getSlugFromUrl(url) {
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/^\/|\/$/g, "");

  if (!pathname) return "home";

  return slugify(pathname.replace(/\//g, "-"), {
    lower: true,
    strict: true,
  });
}

async function getUrlsFromSitemap() {
  const { data } = await axios.get(SITEMAP_URL);
  const parsed = await xml2js.parseStringPromise(data);

  if (!parsed.urlset || !parsed.urlset.url) {
    throw new Error("No URLs found in sitemap.");
  }

  return parsed.urlset.url
    .map((item) => item.loc?.[0])
    .filter(Boolean);
}

async function scrapePage(url) {
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);

  $("script, style, noscript, iframe").remove();

  const title = cleanText($("title").first().text());
  const metaDescription = cleanText(
    $('meta[name="description"]').attr("content") || ""
  );

  const h1 = cleanText($("h1").first().text());

  const headings = [];

  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    headings.push({
      level: el.tagName.toLowerCase(),
      text: cleanText($(el).text()),
    });
  });

  const images = [];

  $("img").each((_, img) => {
    const src = $(img).attr("src");
    const alt = $(img).attr("alt") || "";

    if (src) {
      images.push({
        src: new URL(src, url).href,
        alt: cleanText(alt),
      });
    }
  });

  const links = [];

  $("a").each((_, link) => {
    const href = $(link).attr("href");
    const text = cleanText($(link).text());

    if (href) {
      links.push({
        text,
        href: new URL(href, url).href,
      });
    }
  });

  const mainContent =
    $("main").length > 0
      ? $("main").text()
      : $("body").text();

  return {
    url,
    slug: getSlugFromUrl(url),
    title,
    metaDescription,
    h1,
    content: cleanText(mainContent),
    headings,
    images,
    links,
  };
}

async function main() {
  ensureDir(outputDir);
  ensureDir(pagesDir);

  const urls = await getUrlsFromSitemap();

  const allPages = [];

  for (const url of urls) {
    try {
      console.log(`Scraping: ${url}`);

      const page = await scrapePage(url);
      const filePath = path.join(pagesDir, `${page.slug}.json`);

      fs.writeFileSync(filePath, JSON.stringify(page, null, 2));

      allPages.push({
        url: page.url,
        slug: page.slug,
        title: page.title,
        file: `pages/${page.slug}.json`,
      });
    } catch (error) {
      console.error(`Failed: ${url}`);
      console.error(error.message);
    }
  }

  fs.writeFileSync(
    path.join(outputDir, "pages.json"),
    JSON.stringify(allPages, null, 2)
  );

  console.log("Done. Site content saved in scraped-site folder.");
}

main();