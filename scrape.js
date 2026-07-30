const { loadConfig } = require("./src/config");
const { runCrawl } = require("./src/crawler");

async function main() {
  const config = loadConfig();

  console.log(`Starting migration crawl for ${config.baseUrl}`);
  console.log(`Output directory: ${config.outputDir}`);

  const summary = await runCrawl(config);

  console.log("Crawl complete.");
  console.log(`Successful pages: ${summary.successfulPages}`);
  console.log(`Failed pages: ${summary.failedPages}`);
  console.log(`Skipped pages: ${summary.skippedPages}`);
  console.log(`Reports: ${summary.reportsDirectory}`);
}

main().catch((error) => {
  console.error(`Crawl failed: ${error.message}`);

  if (process.env.DEBUG === "true" && error.stack) {
    console.error(error.stack);
  }

  process.exitCode = 1;
});
