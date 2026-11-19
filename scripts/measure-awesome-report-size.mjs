import { execFileSync } from "node:child_process";
import { globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { FileSystemWriter } from "allure-js-commons/sdk/reporter";

const resultsDir = process.argv[2];
if (!resultsDir) {
  throw new Error("Usage: node scripts/measure-awesome-report-size.mjs <allure-results-directory>");
}

const cli = fileURLToPath(new URL("../packages/cli/cli.js", import.meta.url));
const temporaryDirectory = mkdtempSync(join(tmpdir(), "allure-awesome-size-"));

try {
  // Keep inputs small and stable while retaining the Metrics tab and its optional Timeline chunk.
  const fixtureDirectory = join(temporaryDirectory, "results");
  mkdirSync(fixtureDirectory);
  const fixturePath = join(fixtureDirectory, "fixture-metric.json");
  writeFileSync(
    fixturePath,
    JSON.stringify([{ id: "fixture", key: "fixture.duration", value: 10, start: 100, stop: 110 }]),
  );

  const generate = (name, singleFile) => {
    const configPath = join(temporaryDirectory, `${name}.mjs`);
    const reportPath = join(temporaryDirectory, name);
    const config = {
      name: "Awesome report size fixture",
      plugins: { awesome: { options: { singleFile } } },
    };
    writeFileSync(configPath, `export default ${JSON.stringify(config)};\n`);
    execFileSync(
      process.execPath,
      [cli, "generate", fixtureDirectory, "--config", configPath, "--output", reportPath],
      {
        cwd: temporaryDirectory,
        env: { PATH: process.env.PATH },
        stdio: "inherit",
      },
    );
    return reportPath;
  };

  const singleFile = generate("single", true);
  const directory = generate("directory", false);
  const scripts = new Map(
    globSync("**/*.js", { cwd: directory }).map((name) => {
      const content = readFileSync(join(directory, name));
      return [name, { raw: content.length, gzip: gzipSync(content, { level: 9 }).length }];
    }),
  );

  // Count only local JS referenced by the generated HTML as initial JavaScript.
  const html = readFileSync(join(directory, "index.html"), "utf8");
  const initialFiles = new Set(
    [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
      .map(([, source]) => source.replace(/^\.\//, ""))
      .filter((source) => scripts.has(source)),
  );
  if (initialFiles.size === 0) {
    throw new Error("The generated directory report has no local initial JavaScript");
  }

  const initial = [...initialFiles].map((name) => scripts.get(name));
  const sum = (files, encoding) => files.reduce((bytes, file) => bytes + file[encoding], 0);
  const sizes = {
    "allure.report.size.awesome.singleFile.html": statSync(join(singleFile, "index.html")).size,
    "allure.report.size.awesome.directory.initialJs.raw": sum(initial, "raw"),
    "allure.report.size.awesome.directory.initialJs.gzip": sum(initial, "gzip"),
    "allure.report.size.awesome.directory.allJs.raw": sum([...scripts.values()], "raw"),
    "allure.report.size.awesome.directory.allJs.gzip": sum([...scripts.values()], "gzip"),
  };

  const timestamp = Date.now();
  const metrics = Object.entries(sizes).map(([key, value]) => ({
    id: key,
    key,
    value,
    start: timestamp,
    stop: timestamp,
  }));
  new FileSystemWriter({ resultsDir: resolve(resultsDir) }).writeMetricResults(
    "awesome-report-size-metric.json",
    metrics,
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
