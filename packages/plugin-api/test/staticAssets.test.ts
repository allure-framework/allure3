import { createWriteStream } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

import { epic, feature, label, story } from "allure-js-commons";
import { pack } from "tar-stream";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

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
    expect(assets.featureAssets).toBeUndefined();
    expect([...assets.files.keys()]).toEqual(["app.js", "app.js.LICENSE.txt", "styles.css"]);
    expect(assets.files.get("app.js")?.toString("utf8")).toBe("globalThis.allure = true;");
    expect(assets.files.get("styles.css")?.toString("utf8")).toBe("body { color: purple; }");
  });

  it("packs feature metadata for an inlineable build without exposing it as a runtime asset", async () => {
    const sourceDir = await createFixtureBuild();
    const graph = {
      version: 1,
      initial: ["app.js", "styles.css"],
      base: ["app.js", "app.js.LICENSE.txt", "styles.css"],
      features: {},
    };
    await writeFile(join(sourceDir, "feature-assets.json"), JSON.stringify(graph));
    const archive = join(fixtureRoot, "report.tar");

    await createReportStaticArchive(sourceDir, archive);
    const assets = await readReportStaticAssets(archive);

    expect(assets.featureAssets).toEqual(graph);
    expect([...assets.files.keys()]).toEqual(graph.base);
    expect(assets.manifest).toEqual({ "main.js": "app.js", "main.css": "styles.css" });
  });

  it.each([false, true])(
    "rejects additional runtime chunks even with feature metadata (metadata=%s)",
    async (withMetadata) => {
      const sourceDir = await createFixtureBuild();
      await writeFile(join(sourceDir, "123.app.js"), "chunk");
      if (withMetadata) {
        await writeFile(
          join(sourceDir, "feature-assets.json"),
          JSON.stringify({
            version: 1,
            initial: ["app.js"],
            base: ["app.js", "app.js.LICENSE.txt", "styles.css", "123.app.js"],
            features: {},
          }),
        );
      }

      await expect(createReportStaticArchive(sourceDir, join(fixtureRoot, "report.tar"))).rejects.toThrow(
        "unexpected asset: 123.app.js",
      );
    },
  );

  it("packs additional runtime chunks for multi-file reports", async () => {
    const sourceDir = await createFixtureBuild();
    const archivePath = join(fixtureRoot, "report.tar");

    await writeFile(join(sourceDir, "123.app.js"), "chunk");
    await createReportStaticArchive(sourceDir, archivePath, { singleFileCompatible: false });

    const assets = await readReportStaticAssets(archivePath);

    expect(assets.files.get("123.app.js")?.toString("utf8")).toBe("chunk");
  });

  it("reads optional feature metadata while retaining every report asset and omitting build metadata", async () => {
    const sourceDir = await createFixtureBuild();
    await writeFile(join(sourceDir, "chart.js"), "chart");
    const graph = {
      version: 1,
      initial: ["app.js"],
      base: ["app.js", "styles.css", "app.js.LICENSE.txt"],
      features: { "chart-pie": ["chart.js"] },
    };
    await writeFile(join(sourceDir, "feature-assets.json"), JSON.stringify(graph));
    await writeFile(
      join(sourceDir, "manifest.json"),
      JSON.stringify({ "main.js": "app.js", "main.css": "styles.css", "feature-assets.json": "feature-assets.json" }),
    );
    const archive = join(fixtureRoot, "features.tar");
    await createReportStaticArchive(sourceDir, archive, { singleFileCompatible: false });
    const assets = await readReportStaticAssets(archive);
    expect(assets.featureAssets).toEqual(graph);
    expect([...assets.files.keys()]).toEqual(["app.js", "app.js.LICENSE.txt", "chart.js", "styles.css"]);
    expect(assets.manifest).toEqual({ "main.js": "app.js", "main.css": "styles.css" });
  });

  it.each([
    ["invalid JSON", "{"],
    ["non-object metadata", null],
    [
      "unknown version",
      { version: 2, initial: ["app.js"], base: ["app.js", "styles.css", "app.js.LICENSE.txt"], features: {} },
    ],
    [
      "missing reference",
      {
        version: 1,
        initial: ["app.js"],
        base: ["app.js", "styles.css", "app.js.LICENSE.txt"],
        features: { chart: ["missing.js"] },
      },
    ],
    ["unclassified asset", { version: 1, initial: ["app.js"], base: ["app.js"], features: {} }],
    [
      "initial outside base",
      { version: 1, initial: ["app.js"], base: ["styles.css", "app.js.LICENSE.txt"], features: { chart: ["app.js"] } },
    ],
    [
      "missing initial main",
      { version: 1, initial: [], base: ["app.js", "styles.css", "app.js.LICENSE.txt"], features: {} },
    ],
    [
      "empty feature name",
      { version: 1, initial: ["app.js"], base: ["app.js", "styles.css", "app.js.LICENSE.txt"], features: { "": [] } },
    ],
    [
      "metadata self reference",
      {
        version: 1,
        initial: ["app.js"],
        base: ["app.js", "styles.css", "app.js.LICENSE.txt", "feature-assets.json"],
        features: {},
      },
    ],
  ])("rejects malformed feature metadata: %s", async (name, graph) => {
    const sourceDir = await createFixtureBuild();
    await writeFile(join(sourceDir, "feature-assets.json"), typeof graph === "string" ? graph : JSON.stringify(graph));
    const archive = join(fixtureRoot, "invalid-features.tar");
    await createReportStaticArchive(sourceDir, archive, { singleFileCompatible: false });
    await expect(readReportStaticAssets(archive)).rejects.toThrow(
      name === "unknown version"
        ? "Unsupported report feature-assets.json version: 2; expected 1"
        : /feature-assets.json|Unclassified report feature asset|Initial report assets/,
    );
  });

  it("rejects unsafe archive paths before exposing their contents", async () => {
    const archivePath = join(fixtureRoot, "unsafe.tar");

    await createArchiveWithEntry(archivePath, "../outside.js");

    await expect(readReportStaticAssets(archivePath)).rejects.toThrow("Unsafe report static archive entry");
  });
});
