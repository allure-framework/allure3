import { expect, test } from "@playwright/test";
import { Stage, Status } from "allure-js-commons";

import { TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;

test.beforeAll(async () => {
  bootstrap = await bootstrapReport(
    {
      reportConfig: {
        name: "Parameterized tests report",
        appendHistory: false,
      },
      rawTestResults: [
        {
          name: "ParameterizedTest",
          fullName: "Examples.Tests.ParameterizedTest",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
          parameters: [
            { name: "a", value: "1", excluded: false },
            { name: "b", value: '"foo"', excluded: false },
            { name: "constant", value: "shared", excluded: false },
            { name: "token", value: "secret-token", excluded: false, mode: "masked" },
            { name: "internal", value: "hidden-value", excluded: false, mode: "hidden" },
          ],
        },
        {
          name: "ParameterizedTest",
          fullName: "Examples.Tests.ParameterizedTest",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 2000,
          parameters: [
            { name: "a", value: "2", excluded: false },
            { name: "b", value: '"bar"', excluded: false },
            { name: "constant", value: "shared", excluded: false },
            { name: "token", value: "another-secret", excluded: false, mode: "masked" },
            { name: "internal", value: "another-hidden-value", excluded: false, mode: "hidden" },
          ],
        },
      ],
    },
    {
      layout: "split",
    },
  );
});

test.beforeEach(async ({ page }) => {
  treePage = new TreePage(page);
  await page.goto(bootstrap.url);
});

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test("displays redacted parameter values next to parameterized test names", async () => {
  await expect(treePage.leafLocator).toHaveCount(2);
  await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("ParameterizedTest");
  await expect(treePage.getNthLeafTitleLocator(1)).toHaveText("ParameterizedTest");

  await expect(treePage.getNthLeafLocator(0).getByTestId("tree-leaf-parameters")).toHaveText('1,"foo",shared,<masked>');
  await expect(treePage.getNthLeafLocator(1).getByTestId("tree-leaf-parameters")).toHaveText('2,"bar",shared,<masked>');
  await expect(treePage.leafLocator.filter({ hasText: "secret-token" })).toHaveCount(0);
  await expect(treePage.leafLocator.filter({ hasText: "another-secret" })).toHaveCount(0);
  await expect(treePage.leafLocator.filter({ hasText: "hidden-value" })).toHaveCount(0);
  await expect(treePage.leafLocator.filter({ hasText: "another-hidden-value" })).toHaveCount(0);
});

test("hides parameter values in a narrow tree pane", async ({ page }) => {
  await page.evaluate(() => {
    const storage = (
      globalThis as unknown as {
        localStorage: { setItem: (key: string, value: string) => void };
      }
    ).localStorage;

    storage.setItem("sideBySidePosition", JSON.stringify([20, 80]));
  });
  await page.reload();

  await expect(treePage.leafLocator).toHaveCount(2);
  await expect(treePage.getNthLeafTitleLocator(0)).toBeVisible();
  await expect(treePage.getNthLeafLocator(0).getByTestId("tree-leaf-parameters")).toBeHidden();
});
