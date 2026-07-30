const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function collectJavaScriptFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = [
  path.resolve("scrape.js"),
  ...collectJavaScriptFiles(path.resolve("src")),
  ...collectJavaScriptFiles(path.resolve("tests")),
  ...collectJavaScriptFiles(path.resolve("scripts")),
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Syntax check passed for ${files.length} files.`);
