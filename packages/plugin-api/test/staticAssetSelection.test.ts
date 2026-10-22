import { feature, story } from "allure-js-commons";
import { beforeEach, expect, it } from "vite-plus/test";

import { type ReportStaticAssets, selectReportStaticFiles } from "../src/staticAssets.js";

beforeEach(async () => {
  await feature("selective-single-file-assets");
  await story("static-selection");
});
const archive = (): ReportStaticAssets => ({
  manifest: { "main.js": "app.js" },
  files: new Map(
    ["app.js", "base.css", "shared.js", "pie.js", "pie.LICENSE.txt", "mermaid.js"].map((name) => [
      name,
      Buffer.from(name),
    ]),
  ),
  featureAssets: {
    version: 1,
    initial: ["app.js"],
    base: ["app.js", "base.css"],
    features: {
      "chart-pie": ["pie.js", "shared.js", "pie.LICENSE.txt"],
      "attachment-mermaid": ["mermaid.js", "shared.js"],
    },
  },
});
it("selects base and complete shared/license closures without mutating the archive", () => {
  const assets = archive();
  const selected = selectReportStaticFiles(assets, ["chart-pie", "chart-pie"]);
  expect([...selected.keys()]).toEqual(["app.js", "base.css", "shared.js", "pie.js", "pie.LICENSE.txt"]);
  expect(selected.get("pie.js")).toBe(assets.files.get("pie.js"));
  expect(assets.files.has("mermaid.js")).toBe(true);
  expect([...selectReportStaticFiles(assets, ["chart-pie", "attachment-mermaid"]).keys()]).toEqual([
    ...assets.files.keys(),
  ]);
  expect([...selectReportStaticFiles(assets, []).keys()]).toEqual(["app.js", "base.css"]);
});
it("preserves all files for live/unknown requirements and legacy archives", () => {
  const assets = archive();
  expect(selectReportStaticFiles(assets)).toBe(assets.files);
  expect(selectReportStaticFiles(assets, ["future-viewer"])).toBe(assets.files);
  expect(selectReportStaticFiles({ ...assets, featureAssets: undefined }, [])).toBe(assets.files);
});
