import { expect, test } from "@playwright/test";
import { getEnv, createLaunchWithResults, deleteAllLaunches } from "./fixtures.js";

test.describe("Launches list", () => {
  test("shows loading then table with launch and link to report", async ({ page }) => {
    const env = getEnv();
    const { launchId, FRONTEND_URL } = await createLaunchWithResults(env);

    await page.goto(FRONTEND_URL);

    await expect(page.getByTestId("launches-loading")).toBeVisible();
    await expect(page.getByTestId("launches-table")).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId("launch-row")).toHaveCount(1);
    await expect(page.getByRole("cell", { name: "E2E Launch" })).toBeVisible();
    await expect(page.getByTestId("launch-link-report")).toHaveAttribute(
      "href",
      `/report?launch_id=${launchId}`
    );
    await expect(page.getByTestId("launch-link-report")).toHaveText("Open report");
  });

  test("empty list shows no launches message", async ({ page }) => {
    const env = getEnv();
    await deleteAllLaunches(env.API_BASE_URL);
    await page.goto(env.FRONTEND_URL);

    await expect(page.getByTestId("launches-loading")).toBeVisible();
    await expect(page.getByTestId("launches-empty")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("No launches.")).toBeVisible();
  });
});
