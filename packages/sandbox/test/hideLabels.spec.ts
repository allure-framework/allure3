import { label } from "allure-js-commons";
import { expect, it } from "vitest";

it("sandbox hideLabels: underscore labels are hidden by default in awesome", async () => {
  await label("owner", "sandbox-owner-visible");
  await label("tag", "sandbox-tag-visible");

  await label("_internalSandboxLabel", "hidden-value");
  await label("_fallbackTestCaseId", "legacy-test-case-id");

  expect(true).toBe(true);
});
