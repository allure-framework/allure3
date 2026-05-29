import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, expect, it } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("labels-and-tags");
  await story("hideLabels");
  await label("coverage", "labels-and-tags");
});

it("sandbox hideLabels: underscore labels are hidden by default in awesome", async () => {
  await label("owner", "sandbox-owner-visible");
  await label("tag", "sandbox-tag-visible");

  await label("_internalSandboxLabel", "hidden-value");
  await label("_fallbackTestCaseId", "legacy-test-case-id");

  expect(true).toBe(true);
});
