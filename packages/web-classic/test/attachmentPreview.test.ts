import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, expect, it } from "vite-plus/test";

import { hasAttachmentPreview } from "../src/components/TestResult/TestResultSteps/attachmentPreview.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("attachments");
  await story("attachment preview");
  await label("coverage", "attachments");
});

it.each([
  { contentType: "text/html", expected: true },
  { contentType: "text/html; charset=utf-8", expected: true },
  { contentType: "text/markdown", expected: true },
  { contentType: "application/vnd.allure.diagrams.mermaid", expected: false },
  { contentType: "text/csv", expected: false },
  { contentType: "text/plain", expected: false },
  { contentType: "application/vnd.allure.http+json", expected: false },
  { contentType: undefined, expected: false },
])("$contentType has a preview/code toggle: $expected", ({ contentType, expected }) => {
  expect(hasAttachmentPreview(contentType)).toBe(expected);
});
