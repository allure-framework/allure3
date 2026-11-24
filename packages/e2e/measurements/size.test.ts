import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

import { expect, test } from "@playwright/test";
import { metric } from "allure-js-commons";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const cli = join(root, "packages", "cli", "cli.js");

test("builds the CLI and records its dist size", async () => {
  await exec("yarn", ["workspace", "allure", "build"], { cwd: root, shell: process.platform === "win32" });

  const dist = join(root, "packages", "cli", "dist");
  expect((await stat(dist)).isDirectory()).toBe(true);
  let size = 0;
  for (const file of await readdir(dist, { recursive: true, withFileTypes: true })) {
    if (file.isFile()) {
      size += (await stat(join(file.parentPath, file.name))).size;
    }
  }
  expect(size).toBeGreaterThan(0);
  await metric("allure.bundle.size.cliDist", size);
});

for (const singleFile of [true, false]) {
  test(`generates Awesome (${singleFile ? "single-file" : "directory"}) and records its size`, async () => {
    const testInfo = test.info();
    const results = testInfo.outputPath("results");
    const output = testInfo.outputPath("report");
    const config = testInfo.outputPath("allurerc.mjs");
    await mkdir(results, { recursive: true });
    // Keep the fixture stable and include the lazy-loaded Metrics Timeline.
    await writeFile(
      join(results, "fixture-metric.json"),
      JSON.stringify([{ id: "fixture", key: "fixture.duration", value: 10, start: 100, stop: 110 }]),
    );
    await writeFile(
      config,
      `export default ${JSON.stringify({ output, plugins: { awesome: { options: { singleFile } } } })};\n`,
    );
    await exec(process.execPath, [cli, "generate", results, "--config", config], { cwd: testInfo.outputDir });

    const html = await readFile(join(output, "index.html"));
    expect(html.length).toBeGreaterThan(0);
    if (singleFile) {
      await metric("allure.report.size.awesome.singleFile.html", html.length);
      return;
    }

    const initialFiles = new Set(
      Array.from(html.toString().matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi), ([, source]) =>
        source.replace(/^\.\//, ""),
      ),
    );
    const initial = { raw: 0, gzip: 0 };
    const all = { raw: 0, gzip: 0 };
    const files = await readdir(output, { recursive: true, withFileTypes: true });
    for (const file of files.filter((entry) => entry.isFile() && entry.name.endsWith(".js"))) {
      const path = join(file.parentPath, file.name);
      const content = await readFile(path);
      const compressed = gzipSync(content, { level: 9 }).length;
      all.raw += content.length;
      all.gzip += compressed;
      if (initialFiles.has(relative(output, path).split(sep).join("/"))) {
        initial.raw += content.length;
        initial.gzip += compressed;
      }
    }
    expect(initial.raw).toBeGreaterThan(0);
    expect(all.raw).toBeGreaterThan(initial.raw);
    for (const [kind, sizes] of [
      ["initialJs", initial],
      ["allJs", all],
    ] as const) {
      await metric(`allure.report.size.awesome.directory.${kind}.raw`, sizes.raw);
      await metric(`allure.report.size.awesome.directory.${kind}.gzip`, sizes.gzip);
    }
  });
}
