/**
 * Playwright E2E: Awesome API mode — tests for functionality from ALLURE3_AWESOME_CHECKLIST.md.
 * These tests FAIL until timeline widget, environments from API, etc. are implemented.
 * Run: yarn test:frontend-backend
 */
import { expect, test } from "@playwright/test";
import { getEnv, createLaunch, uploadRawResults, loadDemoResultDTOs, postGlobals } from "./fixtures.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalsPage } from "../pageObjects/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DEMO_RESULTS_DIR = join(__dirname, "../../../backend/test/fixtures/demo-results");

test.describe("Awesome report — TODO (ALLURE3_AWESOME_CHECKLIST)", () => {
  test("Timeline section loads and shows data when GET /widgets/timeline returns items", async ({ page }) => {
    const env = getEnv();
    const dtos = loadDemoResultDTOs(DEMO_RESULTS_DIR);
    if (dtos.length === 0) {
      throw new Error(`Demo fixtures not found at ${DEMO_RESULTS_DIR}`);
    }

    const launchId = await createLaunch(env.API_BASE_URL, "Timeline E2E", "e2e-timeline");
    await uploadRawResults(env.API_BASE_URL, launchId, dtos);

    const reportUrl = `${env.FRONTEND_URL}/report?launch_id=${encodeURIComponent(launchId)}&apiBaseUrl=${encodeURIComponent(env.API_BASE_URL)}`;
    await page.goto(reportUrl);

    // Open section picker dropdown and select Timeline
    const sectionPicker = page.getByRole("button", { name: /report|results/i }).first();
    await expect(sectionPicker).toBeVisible({ timeout: 15000 });
    await sectionPicker.click();
    const timelineItem = page.getByRole("menuitem", { name: /timeline/i }).or(page.getByText("Timeline").first());
    await timelineItem.click();

    // When timeline API + frontend mapping implemented: timeline loads without error, shows bars or empty
    await expect(page.getByText(/timeline|empty|no data/i).first()).toBeVisible({ timeout: 10000 });
    // When backend returns timeline data: bars should appear (no fetch error)
    const errorEl = page.getByText(/failed to fetch|error loading|404/i);
    await expect(errorEl).not.toBeVisible();
  });

  test("Globals: report loads without crash when GET /widgets/globals returns empty object", async ({
    page,
  }) => {
    const env = getEnv();
    const launchId = await createLaunch(env.API_BASE_URL, "Globals E2E", "e2e-globals");
    await uploadRawResults(env.API_BASE_URL, launchId, [
      {
        id: crypto.randomUUID(),
        name: "Test",
        status: "passed",
        labels: [],
        sourceMetadata: { readerId: "e2e", metadata: {} },
      },
    ]);

    const reportUrl = `${env.FRONTEND_URL}/report?launch_id=${encodeURIComponent(launchId)}&apiBaseUrl=${encodeURIComponent(env.API_BASE_URL)}`;
    await page.goto(reportUrl);

    await expect(page.getByTestId("report-header")).toBeVisible({ timeout: 15000 });
    const errorEl = page.getByText(/failed to fetch|error loading|apiBaseUrl not set|path not mapped/i);
    await expect(errorEl).not.toBeVisible();
  });

  test("Globals: header shows exit code when POST globals and GET widgets/globals return exitCode", async ({
    page,
  }) => {
    const env = getEnv();
    const launchId = await createLaunch(env.API_BASE_URL, "Globals ExitCode E2E", "e2e-globals-exit");
    await uploadRawResults(env.API_BASE_URL, launchId, [
      {
        id: crypto.randomUUID(),
        name: "Test",
        status: "passed",
        labels: [],
        sourceMetadata: { readerId: "e2e", metadata: {} },
      },
    ]);
    await postGlobals(env.API_BASE_URL, launchId, {
      exitCode: { original: 1, actual: 0 },
    });

    const reportUrl = `${env.FRONTEND_URL}/report?launch_id=${encodeURIComponent(launchId)}&apiBaseUrl=${encodeURIComponent(env.API_BASE_URL)}`;
    await page.goto(reportUrl);

    const reportHeader = page.getByTestId("report-header");
    await expect(reportHeader).toBeVisible({ timeout: 15000 });
    await expect(reportHeader.getByTestId("test-result-status-passed")).toBeVisible();
    await expect(page.getByTestId("report-data")).toContainText(/exit code 0.*original 1|original 1/);
  });

  test("Globals: Global Attachments and Global Errors tabs visible and clickable", async ({
    page,
  }) => {
    const env = getEnv();
    const launchId = await createLaunch(env.API_BASE_URL, "Globals Tabs E2E", "e2e-globals-tabs");
    await uploadRawResults(env.API_BASE_URL, launchId, [
      {
        id: crypto.randomUUID(),
        name: "Test",
        status: "passed",
        labels: [],
        sourceMetadata: { readerId: "e2e", metadata: {} },
      },
    ]);

    const reportUrl = `${env.FRONTEND_URL}/report?launch_id=${encodeURIComponent(launchId)}&apiBaseUrl=${encodeURIComponent(env.API_BASE_URL)}`;
    await page.goto(reportUrl);

    const globalsPage = new GlobalsPage(page);
    await expect(globalsPage.globalAttachmentsTabLocator).toBeVisible({ timeout: 15000 });
    await expect(globalsPage.globalErrorsTabLocator).toBeVisible();
    await globalsPage.globalAttachmentsTabLocator.click();
    await expect(page.getByText(/no attachments|attachments information|0/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("Environment picker shows options from GET /launches/:id/environments when implemented", async ({
    page,
  }) => {
    const env = getEnv();
    const launchId = await createLaunch(env.API_BASE_URL, "Envs E2E", "e2e-envs");
    await uploadRawResults(env.API_BASE_URL, launchId, [
      {
        id: crypto.randomUUID(),
        name: "Test",
        status: "passed",
        labels: [],
        sourceMetadata: { readerId: "e2e", metadata: {} },
      },
    ]);

    const reportUrl = `${env.FRONTEND_URL}/report?launch_id=${encodeURIComponent(launchId)}&apiBaseUrl=${encodeURIComponent(env.API_BASE_URL)}`;
    await page.goto(reportUrl);

    const envPicker = page.getByTestId("environment-picker-button");
    await expect(envPicker).toBeVisible({ timeout: 15000 });

    // When implemented: picker shows env names from API (e.g. "All", "N1", "N2" for parent launch)
    const pickerText = await envPicker.textContent();
    expect(pickerText?.length).toBeGreaterThan(0);
  });
});
