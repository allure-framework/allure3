import AwesomePlugin from "@allurereport/plugin-awesome";
import type { RawTestResult, ResultsReader } from "@allurereport/reader-api";
import { expect, test } from "@playwright/test";
import { step } from "allure-js-commons";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../../utils/index.js";

let bootstrap: ReportBootstrap;
const longContent = Array.from({ length: 60 }, (_, i) => `<p>Expected paragraph ${i + 1}</p>`).join("");
const results: RawTestResult[] = [
  {
    uuid: "documented-test",
    name: "Documented test",
    fullName: "sections.documented",
    status: "passed",
    description: "**Description** remains visible",
    steps: [{ type: "step", name: "Execute test body", status: "passed" }],
    precondition: "**Signed in** with `admin` access",
    expectedResult: "This markdown must not replace HTML",
    expectedResultHtml: `<h2>Account overview</h2><table><tr><th>Role</th></tr><tr><td>Admin</td></tr></table>${longContent}<script>window.bad = true</script>`,
  },
  {
    uuid: "other-test",
    name: "Other test",
    fullName: "sections.other",
    status: "passed",
    preconditionHtml: "<p>Other precondition</p>",
    expectedResult: "",
  },
];

// Exercise the supported reader boundary without adding fields to the Allure 2 format.
const reader: ResultsReader = {
  readerId: () => "sections-fixture",
  matches: (file) => file.getOriginalFileName() === "sections.json",
  async read(visitor) {
    for (const result of results) {
      await visitor.visitTestResult(result, { readerId: this.readerId() });
    }
    for (const type of ["before", "after"] as const) {
      await visitor.visitTestFixtureResult(
        {
          uuid: `documented-${type}`,
          testResults: ["documented-test"],
          type,
          name: type === "before" ? "Prepare session" : "Clean session",
          status: "passed",
          steps: [],
        },
        { readerId: this.readerId() },
      );
    }
    return true;
  },
};

test.beforeAll(async () => {
  bootstrap = await bootstrapReport({
    reportConfig: {
      name: "Test documentation sections",
      readers: [reader],
      plugins: [{ id: "awesome", enabled: true, plugin: new AwesomePlugin(), options: {} }],
    },
    attachments: [{ source: "sections.json", content: Buffer.from("{}") }],
  });
});

test.afterAll(async () => {
  await bootstrap?.shutdown();
});

for (const theme of ["light", "dark"] as const) {
  test(`documentation sections render and collapse independently in ${theme} theme`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(bootstrap.url);
    const tree = new TreePage(page);
    const resultPage = new TestResultPage(page);
    await tree.openTestResultByTitle("Documented test");
    const description = page.getByTestId("test-result-description");
    const precondition = page.getByTestId("test-result-precondition");
    const expected = page.getByTestId("test-result-expectedResult");
    const preconditionFrame = page.frameLocator('[data-testid="test-result-precondition-frame"]');
    const expectedFrame = page.frameLocator('[data-testid="test-result-expectedResult-frame"]');

    await step("Check rendered markdown, HTML precedence, section order and iframe geometry", async () => {
      await expect(description).toBeVisible();
      await expect(preconditionFrame.locator("strong")).toHaveText("Signed in");
      await expect(preconditionFrame.locator("code")).toHaveText("admin");
      await expect(expectedFrame.locator("table")).toBeVisible();
      await expect(expectedFrame.locator("body")).not.toContainText("This markdown");
      await expect(expectedFrame.locator("script")).toHaveCount(0);
      await expect(expectedFrame.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator('[data-testid="test-result-expectedResult-frame"]')).toHaveAttribute(
        "title",
        "Expected result",
      );
      const order = await page
        .locator(
          '[data-testid="test-result-description"], [data-testid="test-result-precondition"], [data-testid="test-result-setup-dropdown"], [data-testid="test-result-steps-root"], [data-testid="test-result-teardown-dropdown"], [data-testid="test-result-expectedResult"]',
        )
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")));
      expect(order).toEqual([
        "test-result-description",
        "test-result-precondition",
        "test-result-setup-dropdown",
        "test-result-steps-root",
        "test-result-teardown-dropdown",
        "test-result-expectedResult",
      ]);
      await expect
        .poll(async () =>
          page
            .getByTestId("test-result-expectedResult-frame")
            .evaluate(
              (frame: { clientHeight: number; contentDocument?: { documentElement: { scrollHeight: number } } }) => {
                const contentHeight = frame.contentDocument?.documentElement.scrollHeight ?? 0;
                return frame.clientHeight > 1000 && frame.clientHeight >= contentHeight;
              },
            ),
        )
        .toBe(true);
      await precondition.scrollIntoViewIfNeeded();
      await testInfo.attach(`sections-header-${theme}`, { body: await page.screenshot(), contentType: "image/png" });
      await expectedFrame.getByText("Expected paragraph 60", { exact: true }).scrollIntoViewIfNeeded();
      await testInfo.attach(`sections-${theme}`, { body: await page.screenshot(), contentType: "image/png" });
    });

    await step("Check keyboard collapse and independent state across sections and results", async () => {
      const button = precondition.getByRole("button", { name: "Precondition" });
      await button.focus();
      await expect(button).toBeFocused();
      await button.press("Enter");
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(precondition.locator("iframe")).toHaveCount(0);
      await expect(description.locator("iframe")).toHaveCount(1);
      await expect(expected.locator("iframe")).toHaveCount(1);

      await resultPage.clickNextTestResult();
      await expect(resultPage.titleLocator).toHaveText("Other test");
      await expect(preconditionFrame.locator("body")).toContainText("Other precondition");
      await expect(page.getByTestId("test-result-description")).toHaveCount(0);
      await expect(page.getByTestId("test-result-expectedResult")).toHaveCount(0);

      await resultPage.clickPrevTestResult();
      await expect(resultPage.titleLocator).toHaveText("Documented test");
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await button.press("Space");
      await expect(preconditionFrame.locator("strong")).toHaveText("Signed in");
    });
  });
}
