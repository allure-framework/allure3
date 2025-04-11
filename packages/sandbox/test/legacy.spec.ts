/// <reference types="allure-vitest" />
import { expect, it } from "vitest";

it("sample test", async () => {
  await allure.owner("John Doe x");
  await allure.issue("JIRA-2", "https://example.org");
  await allure.step("step 1", async () => {
    await allure.step("step 1.2", async () => {
      await allure.attachment("text attachment", "some data", "text/plain");
    });
  });
  await allure.step("step 2", async () => {
    await allure.step("step 2.2", async () => {
      await allure.step("step 2.3", async () => {
        try {
          await allure.step("step 2.3-1", async () => {
            expect(true).toBe(false);
          });
        } catch (err) {}
      });
    });
  });
});
