/// <reference types="allure-vitest" />
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, it } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("legacy");
  await label("coverage", "report-output");
});

it("sample test", async () => {
  await allure.owner("John Doe x");
  await allure.issue("JIRA-2", "https://example.org");
  await allure.step("step 1", async () => {
    await allure.step("step 1.2", async () => {
      await allure.attachment("text attachment", "some data", "text/plain");
    });
  });
  await allure.step("step 2", async () => {});
});
