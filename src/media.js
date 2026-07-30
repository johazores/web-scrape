const path = require("path");
const { getExtension, shortHash } = require("./url");
const { atomicWrite } = require("./output");

function sanitizeExtension(value) {
  const extension = getExtension(value);
  return /^\.[a-z0-9]{1,8}$/i.test(extension) ? extension : ".bin";
}

async function downloadMediaForPage(page, context) {
  const { config, directories, http, state } = context;

  if (!config.downloadMedia || config.maxMediaFiles === 0) {
    return;
  }

  for (const media of page.media) {
    if (Object.keys(state.media).length >= config.maxMediaFiles) {
      return;
    }

    if (state.media[media.url]) {
      media.localFile = state.media[media.url].file || null;
      continue;
    }

    try {
      const response = await http.get(media.url, {
        responseType: "arraybuffer",
        headers: { Accept: "*/*" },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}`);
      }

      const fileName = `${shortHash(response.finalUrl, 16)}${sanitizeExtension(response.finalUrl)}`;
      const filePath = path.join(directories.mediaFiles, fileName);
      atomicWrite(filePath, Buffer.from(response.data));
      const relativeFile = path.relative(config.outputDir, filePath).replace(/\\/g, "/");

      state.media[media.url] = {
        sourceUrl: media.url,
        finalUrl: response.finalUrl,
        status: response.status,
        contentType: response.headers["content-type"] || null,
        file: relativeFile,
      };
      media.localFile = relativeFile;
    } catch (error) {
      state.media[media.url] = {
        sourceUrl: media.url,
        file: null,
        error: error.message,
      };
    }
  }
}

module.exports = {
  downloadMediaForPage,
  sanitizeExtension,
};
