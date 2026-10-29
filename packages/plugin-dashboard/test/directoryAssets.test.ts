import type { ReportFiles } from "@allurereport/plugin-api";
import * as staticAssets from "@allurereport/plugin-api/static-assets";
import { readReportStaticAssets } from "@allurereport/plugin-api/static-assets";
import { feature, story } from "allure-js-commons";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { generateStaticFiles } from "../src/generators.js";

beforeEach(async () => {
  await feature("selective-directory-assets");
  await story("archive-selection-and-custom-writer");
});

it.each([
  { name: "base only", requiredAssetFeatures: [] },
  { name: "pie", requiredAssetFeatures: ["chart-pie"] },
  { name: "multiple renderers", requiredAssetFeatures: ["chart-pie", "chart-bar", "chart-treemap"] },
  { name: "unknown feature", requiredAssetFeatures: ["future-feature"] },
  { name: "unknown requirements", requiredAssetFeatures: undefined },
])("copies the dependency closure and licenses through a custom writer: $name", async ({ requiredAssetFeatures }) => {
  const files = new Map<string, Buffer>();
  const writer: ReportFiles = {
    addFile: async (file, content) => {
      files.set(file, content);
      return file;
    },
  };
  await generateStaticFiles({
    reportName: "test",
    allureVersion: "test",
    reportUuid: "test",
    reportDataFiles: [],
    reportFiles: writer,
    requiredAssetFeatures,
  });
  const archive = await readReportStaticAssets(new URL("../dist/static/report.tar", import.meta.url));
  const graph = archive.featureAssets!;
  const selected =
    !requiredAssetFeatures || requiredAssetFeatures.includes("future-feature")
      ? new Set(archive.files.keys())
      : new Set([...graph.base, ...requiredAssetFeatures.flatMap((name) => graph.features[name])]);
  expect([...files.keys()].sort()).toEqual([...selected, "index.html"].sort());
  for (const file of selected) expect(files.get(file)?.equals(archive.files.get(file)!), file).toBe(true);
  expect(files.has("feature-assets.json")).toBe(false);
  expect(files.get("index.html")!.toString()).toContain(`src="${archive.manifest["main.js"]}"`);
});

afterEach(() => vi.restoreAllMocks());

it("does not link a feature-only font excluded from the copied assets", async () => {
  const archive = await readReportStaticAssets(new URL("../dist/static/report.tar", import.meta.url));
  const font = "optional.woff2";
  vi.spyOn(staticAssets, "readReportStaticAssets").mockResolvedValue({
    ...archive,
    manifest: { ...archive.manifest, [font]: font },
    files: new Map([...archive.files, [font, Buffer.from("optional font")]]),
    featureAssets: {
      ...archive.featureAssets!,
      features: { ...archive.featureAssets!.features, "optional-font": [font] },
    },
  });
  const files = new Map<string, Buffer>();
  await generateStaticFiles({
    reportName: "test",
    allureVersion: "test",
    reportUuid: "test",
    reportDataFiles: [],
    requiredAssetFeatures: [],
    reportFiles: {
      addFile: async (path, content) => {
        files.set(path, content);
        return path;
      },
    },
  });
  expect(files.has(font)).toBe(false);
  expect(files.get("index.html")!.toString()).not.toContain(font);
});
