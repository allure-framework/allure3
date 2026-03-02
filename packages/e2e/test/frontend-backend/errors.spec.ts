import { expect, test } from "@playwright/test";
import { getEnv } from "./fixtures.js";

test.describe("Report and list error states", () => {
  test("report without launch_id shows missing launch message", async ({ page }) => {
    const env = getEnv();
    await page.goto(`${env.FRONTEND_URL}/report`);
    await expect(page.getByTestId("report-error-missing-launch")).toBeVisible();
    await expect(page.getByText("Missing query parameter")).toBeVisible();
  });

  test("report with empty apiBaseUrl shows missing api message", async ({ page }) => {
    const env = getEnv();
    await page.goto(`${env.FRONTEND_URL}/report?launch_id=any&apiBaseUrl=`);
    await expect(page.getByTestId("report-error-missing-api")).toBeVisible();
    await expect(page.getByText("Missing")).toBeVisible();
  });
});
