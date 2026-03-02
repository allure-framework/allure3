import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnv, createLaunch, uploadRawResults, loadDemoResultDTOs } from "./fixtures.js";
import { TreePage } from "../pageObjects/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEMO_RESULTS_DIR = join(__dirname, "../../../backend/test/fixtures/demo-results");

test.describe("Report page with demo data", () => {
  test("shows tree and metadata with multiple results", async ({ page }) => {
    const env = getEnv();
    const dtos = loadDemoResultDTOs(DEMO_RESULTS_DIR);
    if (dtos.length === 0) {
      throw new Error(
        `Demo fixtures not found at ${DEMO_RESULTS_DIR}. Add *-result.json files or fix path.`
      );
    }

    const launchId = await createLaunch(env.API_BASE_URL, "Demo Report E2E", "e2e-demo");
    await uploadRawResults(env.API_BASE_URL, launchId, dtos);

    const reportUrl = `${env.FRONTEND_URL}/report?launch_id=${encodeURIComponent(launchId)}&apiBaseUrl=${encodeURIComponent(env.API_BASE_URL)}`;
    await page.goto(reportUrl);

    const treePage = new TreePage(page);
    await expect(treePage.leafLocator.first()).toBeVisible({ timeout: 15000 });
    const count = await treePage.leafLocator.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
