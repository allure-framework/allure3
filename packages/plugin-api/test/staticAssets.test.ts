import { createWriteStream } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

import { epic, feature, label, story } from "allure-js-commons";
import { pack } from "tar-stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createReportStaticArchive } from "../src/packStaticAssets.js";
import { readReportStaticAssets } from "../src/staticAssets.js";

let fixtureRoot: string;

beforeEach(async () => {
  await epic("coverage");
  await feature("report-static-assets");
  await story("archive");
  await label("coverage", "report-static-assets");

  fixtureRoot = await mkdtemp(join(tmpdir(), "allure-report-static-"));
});

afterEach(async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
});

const createFixtureBuild = async () => {
  const sourceDir = join(fixtureRoot, "build");

  await mkdir(sourceDir);
  await writeFile(join(sourceDir, "manifest.json"), JSON.stringify({ "main.js": "app.js", "main.css": "styles.css" }));
  await writeFile(join(sourceDir, "app.js"), "globalThis.allure = true;");
  await writeFile(join(sourceDir, "app.js.LICENSE.txt"), "license");
  await writeFile(join(sourceDir, "styles.css"), "body { color: purple; }");

  return sourceDir;
};

const createArchiveWithEntry = async (archivePath: string, name: string) => {
  const archive = pack();
  const output = pipeline(archive, createWriteStream(archivePath));

  archive.entry({ name }, "content");
  archive.finalize();
  await output;
};

describe("report static archives", () => {
  it("packs an inlineable build as reproducible uncompressed tar and restores every asset", async () => {
    const sourceDir = await createFixtureBuild();
    const firstArchive = join(fixtureRoot, "first.tar");
    const secondArchive = join(fixtureRoot, "second.tar");

    await createReportStaticArchive(sourceDir, firstArchive);
    await createReportStaticArchive(sourceDir, secondArchive);

    const firstArchiveContent = await readFile(firstArchive);

    expect(firstArchiveContent).toEqual(await readFile(secondArchive));
    expect(firstArchiveContent.subarray(257, 262).toString("ascii")).toBe("ustar");

    const assets = await readReportStaticAssets(firstArchive);

    expect(assets.manifest).toEqual({ "main.js": "app.js", "main.css": "styles.css" });
    expect([...assets.files.keys()]).toEqual(["app.js", "app.js.LICENSE.txt", "styles.css"]);
    expect(assets.files.get("app.js")?.toString("utf8")).toBe("globalThis.allure = true;");
    expect(assets.files.get("styles.css")?.toString("utf8")).toBe("body { color: purple; }");
  });

  it("rejects builds containing additional runtime chunks", async () => {
    const sourceDir = await createFixtureBuild();

    await writeFile(join(sourceDir, "123.app.js"), "chunk");

    await expect(createReportStaticArchive(sourceDir, join(fixtureRoot, "report.tar"))).rejects.toThrow(
      "unexpected asset: 123.app.js",
    );
  });

  it("rejects unsafe archive paths before exposing their contents", async () => {
    const archivePath = join(fixtureRoot, "unsafe.tar");

    await createArchiveWithEntry(archivePath, "../outside.js");

    await expect(readReportStaticAssets(archivePath)).rejects.toThrow("Unsafe report static archive entry");
  });
});
