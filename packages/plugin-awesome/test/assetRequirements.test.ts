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
it("retains source viewers and nested/fixture/retry attachments", () => {
  const test = {
    ...empty,
    steps: [{ type: "step", name: "nested", status: "passed", parameters: [], steps: [attachment("text/markdown")] }],
    setup: [{ steps: [attachment("text/html")] }],
    teardown: [{ steps: [attachment("text/csv")] }],
    retries: [{ steps: [attachment("application/vnd.allure.diagrams.mermaid")] }],
  } as ReportTestResult;
  expect(collectViewerAssetFeatures([test], [{ contentType: "application/vnd.allure.http+json" }], globals)).toEqual([
    "attachment-code",
    "attachment-html",
    "attachment-http",
    "attachment-markdown",
    "attachment-mermaid",
    "attachment-table",
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

const comparison = { expected: "old value", actual: "new value" };
it.each([
  ["test error", { error: comparison }],
  ["additional error", { errors: [comparison] }],
  [
    "nested step error",
    {
      steps: [
        {
          type: "step",
          steps: [{ type: "step", steps: [], error: comparison }],
        },
      ],
    },
  ],
  ["setup error", { setup: [{ steps: [], error: comparison }] }],
  ["teardown error", { teardown: [{ steps: [], error: comparison }] }],
  ["retry error", { retries: [{ steps: [], error: comparison }] }],
  ["historical error", { history: [{ error: comparison }] }],
])("retains comparison assets when only %s requires them", (_name, result) => {
  const test = { ...empty, ...result } as ReportTestResult;
  expect(collectViewerAssetFeatures([test], [], globals)).toEqual(["error-diff"]);
});

it.each([
  ["global error", { errors: [comparison], attachments: [] }],
  ["environment error", { errors: [], attachments: [], errorsByEnv: { prod: [comparison] } }],
])("retains comparison assets when only %s requires them", (_name, globals) => {
  expect(collectViewerAssetFeatures([empty], [], globals)).toEqual(["error-diff"]);
});
