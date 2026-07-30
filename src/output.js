const fs = require("fs");
const path = require("path");
const slugify = require("slugify");
const { shortHash } = require("./url");

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function atomicWrite(filePath, content) {
  ensureDir(path.dirname(filePath));
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, content);
  fs.renameSync(temporaryPath, filePath);
}

function writeJson(filePath, value) {
  atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  atomicWrite(filePath, value);
}

function initializeOutput(config) {
  const directories = {
    root: config.outputDir,
    pages: path.join(config.outputDir, "pages"),
    media: path.join(config.outputDir, "media"),
    mediaFiles: path.join(config.outputDir, "media", "files"),
    seo: path.join(config.outputDir, "seo"),
    sitemap: path.join(config.outputDir, "sitemap"),
    reports: path.join(config.outputDir, "reports"),
  };

  Object.values(directories).forEach(ensureDir);
  return directories;
}

function getPageDirectory(pagesDirectory, normalizedUrl) {
  const url = new URL(normalizedUrl);
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      let decoded = segment;

      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // Keep the encoded segment when it cannot be decoded safely.
      }

      return (
        slugify(decoded, {
          lower: true,
          strict: true,
        }) || shortHash(segment, 8)
      );
    });

  if (segments.length === 0) {
    segments.push("home");
  }

  segments[segments.length - 1] += `--${shortHash(normalizedUrl, 8)}`;

  return path.join(pagesDirectory, ...segments);
}

function pageToMarkdown(page) {
  const frontmatter = {
    sourceUrl: page.source.finalUrl,
    title: page.seo.title,
    description: page.seo.description,
    canonical: page.seo.canonical,
    language: page.language,
    author: page.author,
    published: page.dates.published,
    modified: page.dates.modified,
    categories: page.taxonomy.categories,
    tags: page.taxonomy.tags,
  };

  return `---\n${Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n")}\n---\n\n${page.content.markdown}\n`;
}

function writePage(page, directories, config) {
  const pageDirectory = getPageDirectory(directories.pages, page.source.normalizedUrl);
  ensureDir(pageDirectory);

  const files = {};

  if (config.outputFormats.has("json")) {
    files.json = path.join(pageDirectory, "index.json");
    writeJson(files.json, page);
  }

  if (config.outputFormats.has("markdown")) {
    files.markdown = path.join(pageDirectory, "index.md");
    writeText(files.markdown, pageToMarkdown(page));
  }

  return Object.fromEntries(
    Object.entries(files).map(([format, filePath]) => [
      format,
      path.relative(config.outputDir, filePath).replace(/\\/g, "/"),
    ])
  );
}

function escapeCsv(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);

  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function writeCsv(filePath, rows, columns) {
  const lines = [columns.join(",")];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCsv(row[column])).join(","));
  }

  writeText(filePath, `${lines.join("\n")}\n`);
}

module.exports = {
  atomicWrite,
  ensureDir,
  getPageDirectory,
  initializeOutput,
  pageToMarkdown,
  writeCsv,
  writeJson,
  writePage,
  writeText,
};
