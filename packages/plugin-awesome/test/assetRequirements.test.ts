import type { TestStepResult } from "@allurereport/core-api";
import type { PluginGlobals, ReportTestResult } from "@allurereport/plugin-api";
import { feature, story } from "allure-js-commons";
import { beforeEach, expect, it } from "vite-plus/test";

import { collectViewerAssetFeatures } from "../src/assetRequirements.js";

beforeEach(async () => {
  await feature("selective-single-file-assets");
  await story("attachment-requirements");
});
const attachment = (contentType: string): TestStepResult => ({
  type: "attachment",
  link: {
    id: "attachment",
    name: "attachment",
    ext: ".txt",
    originalFileName: "attachment.txt",
    used: true,
    missed: false,
    contentType,
  },
});
const empty = { setup: [], teardown: [], steps: [], history: [], attachments: [] } as unknown as ReportTestResult;
const globals: PluginGlobals = { errors: [], attachments: [] };
it("retains source viewers, nested/fixture/retry attachments, and historical/global comparisons", () => {
  const test = {
    ...empty,
    steps: [{ type: "step", name: "nested", status: "passed", parameters: [], steps: [attachment("text/markdown")] }],
    setup: [{ steps: [attachment("text/html")] }],
    teardown: [{ steps: [attachment("text/csv")] }],
    retries: [
      { steps: [attachment("application/vnd.allure.diagrams.mermaid")], error: { expected: "old", actual: "new" } },
    ],
    history: [{ error: { expected: "historical", actual: "current" } }],
  } as ReportTestResult;
  expect(
    collectViewerAssetFeatures([test], [{ contentType: "application/vnd.allure.http+json" }], {
      ...globals,
      errorsByEnv: { prod: [{ actual: "a", expected: "b", message: "global assertion" }] },
    }),
  ).toEqual([
    "attachment-code",
    "attachment-html",
    "attachment-http",
    "attachment-markdown",
    "attachment-mermaid",
    "attachment-table",
    "error-diff",
  ]);
});
it("preserves image-diff previews from environment globals and omits download-only/ordinary images", () => {
  const link = {
    id: "global",
    ext: ".json",
    name: "global",
    contentType: "application/vnd.allure.image.diff",
    originalFileName: "global.json",
    used: true,
    missed: false,
  };
  expect(
    collectViewerAssetFeatures([empty], [{ contentType: "application/zip" }, { contentType: "image/png" }], {
      ...globals,
      attachmentsByEnv: { staging: [link] },
    }),
  ).toEqual(["attachment-image-diff"]);
  expect(collectViewerAssetFeatures([empty], [], globals)).toEqual([]);
});
