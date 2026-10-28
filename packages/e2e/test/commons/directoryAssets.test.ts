import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ChartType, type ChartOptions } from "@allurereport/charts-api";
import { AllureReport, FileSystemReportFiles } from "@allurereport/core";
import { readReportStaticAssets, selectReportStaticFiles } from "@allurereport/plugin-api/static-assets";
import AwesomePlugin from "@allurereport/plugin-awesome";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { expect, test } from "@playwright/test";
import { attachment, feature, label } from "allure-js-commons";

import { TestResultPage } from "../pageObjects/index.js";
import { reportEntries, serveReport } from "../utils/index.js";

test.beforeEach(async ({ page, browserName }) => {
  await feature("selective-directory-assets");
  await label("env", browserName);
  await page.route("https://**/*", (route) => route.abort());
});

for (const frontend of ["awesome", "dashboard"] as const) {
  test(`${frontend} copies the selected dependency closure into clean single and multiple report outputs`, async ({
    page,
  }) => {
    const root = await mkdtemp(join(tmpdir(), "directory-assets-"));
    const output = join(root, "report");
    const results = join(root, "results");
    await mkdir(results);
    await writeFile(
      join(results, "test-result.json"),
      JSON.stringify({ uuid: "test", name: "passed", fullName: "passed", status: "passed", start: 1000, stop: 1100 }),
    );
    const archive = await readReportStaticAssets(
      new URL(`../../../plugin-${frontend}/dist/static/report.tar`, import.meta.url),
    );
    const generate = async (charts: ChartOptions[], singleFile = false, multiple = false) => {
      await rm(output, { recursive: true, force: true });
      const createPlugin = () =>
        frontend === "awesome"
          ? new AwesomePlugin({ charts, singleFile })
          : new DashboardPlugin({ layout: charts, singleFile });
      const generation = new AllureReport({
        name: "Allure Report",
        open: false,
        port: undefined,
        output,
        reportFiles: new FileSystemReportFiles(output),
        appendHistory: false,
        plugins: (multiple ? [frontend, "second"] : [frontend]).map((id) => ({
          id,
          enabled: true,
          options: {},
          plugin: createPlugin(),
        })),
      });
      await generation.start();
      await generation.readDirectory(results);
      await generation.done();
    };
    const bytesUnder = async (directory: string): Promise<number> => {
      let total = 0;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        total += entry.isDirectory() ? await bytesUnder(path) : (await stat(path)).size;
      }
      return total;
    };
    const check = async (features: string[]) => {
      const expected = selectReportStaticFiles(archive, features);
      const names = await reportEntries(output);
      const present = names.filter((file) => archive.files.has(file));
      expect(present.sort()).toEqual([...expected.keys()].sort());
      expect(names.filter((file) => file.endsWith(".js")).sort()).toEqual(
        [...expected.keys()].filter((file) => file.endsWith(".js")).sort(),
      );
      for (const [file, content] of expected)
        expect((await readFile(join(output, file))).equals(content), file).toBe(true);
      expect(names).not.toContain("feature-assets.json");
      expect(names).not.toContain("manifest.json");
    };
    let server: Awaited<ReturnType<typeof serveReport>> | undefined;
    try {
      const allCharts = [
        { type: ChartType.CurrentStatus, title: "Current status" },
        { type: ChartType.StatusDynamics, title: "Status dynamics" },
        { type: ChartType.SuccessRateDistribution, title: "Success rate" },
        { type: ChartType.ProblemsDistribution, title: "Problems", by: "environment" },
        { type: ChartType.TestingPyramid, title: "Testing pyramid" },
      ] satisfies ChartOptions[];
      await generate(allCharts);
      await check(["chart-pie", "chart-bar", "chart-treemap", "chart-heatmap", "chart-funnel"]);
      await generate([]);
      await check([]);
      await generate([{ type: ChartType.CurrentStatus, title: "Selected pie" }]);
      await check(["chart-pie"]);
      const selected = selectReportStaticFiles(archive, ["chart-pie"]);
      const jsBytes = (files: ReadonlyMap<string, Buffer>) =>
        [...files].filter(([file]) => file.endsWith(".js")).reduce((total, [, data]) => total + data.length, 0);
      const directoryBytes = await bytesUnder(output);
      const measurement = {
        frontend,
        scenario: "pie-only",
        fullJavaScriptBytes: jsBytes(archive.files),
        selectedJavaScriptBytes: jsBytes(selected),
        fullScripts: [...archive.files.keys()].filter((file) => file.endsWith(".js")).length,
        selectedScripts: [...selected.keys()].filter((file) => file.endsWith(".js")).length,
        directoryBytes,
      };
      const errors: string[] = [],
        missing: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.url().endsWith(".js") && response.status() >= 400) missing.push(response.url());
      });
      server = await serveReport(output);
      await page.goto(server.url);
      if (frontend === "awesome")
        await page.evaluate(() => {
          window.location.hash = "#/charts";
        });
      await expect(
        page.getByText("Selected pie", { exact: true }).locator("../..").locator("svg path").first(),
      ).toBeVisible();
      expect(errors).toEqual([]);
      expect(missing).toEqual([]);
      await server.shutdown();
      server = undefined;
      await generate([{ type: ChartType.CurrentStatus, title: "Selected pie" }], true);
      await attachment(
        "Asset sizes (same build, bytes)",
        JSON.stringify({ ...measurement, singleFileHtmlBytes: (await stat(join(output, "index.html"))).size }),
        "application/json",
      );
      expect((await reportEntries(output)).filter((file) => file.endsWith(".js"))).toEqual([]);
      await generate(allCharts, false, true);
      expect(await readFile(join(output, "second/index.html"), "utf8")).toContain("<html");
      server = await serveReport(output);
      await page.goto(new URL(`${frontend}/`, server.url).href);
      if (frontend === "awesome")
        await page.evaluate(() => {
          window.location.hash = "#/charts";
        });
      await expect(
        page.getByText(allCharts[0].title, { exact: true }).locator("../..").locator("svg path").first(),
      ).toBeVisible();
      expect(errors).toEqual([]);
      expect(missing).toEqual([]);
      await server.shutdown();
      server = undefined;
    } finally {
      await server?.shutdown();
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("directory live keeps a viewer for an attachment arriving on an already opened test page", async ({ page }) => {
  const root = await mkdtemp(join(tmpdir(), "directory-live-assets-"));
  const output = join(root, "report"),
    results = join(root, "results");
  await mkdir(results);
  const resultPath = join(results, "test-result.json");
  const result = { uuid: "test", name: "Live attachments", fullName: "live-attachments", status: "passed" };
  await writeFile(resultPath, JSON.stringify(result));
  const generation = new AllureReport({
    name: "Allure Report",
    open: false,
    port: undefined,
    realTime: true,
    output,
    reportFiles: new FileSystemReportFiles(output),
    appendHistory: false,
    plugins: [{ id: "awesome", enabled: true, options: {}, plugin: new AwesomePlugin({ charts: [] }) }],
  });
  let server: Awaited<ReturnType<typeof serveReport>> | undefined;
  try {
    await generation.start();
    await generation.readDirectory(results);
    await expect(async () => {
      await readFile(join(output, "awesome/index.html"));
    }).toPass();
    server = await serveReport(join(output, "awesome"));
    await page.goto(server.url);
    await page.getByText("Live attachments", { exact: true }).click();
    await writeFile(join(results, "late.mmd"), "sequenceDiagram\nClient->>Server: late directory viewer");
    await writeFile(
      resultPath,
      JSON.stringify({
        ...result,
        attachments: [{ name: "Late diagram", source: "late.mmd", type: "application/vnd.allure.diagrams.mermaid" }],
      }),
    );
    await generation.readDirectory(results);
    await expect(async () => {
      // Uses the same data-only hook as Awesome's live reload on a test page; does not reload the document.
      await page.evaluate(() =>
        (window as Window & { __allureLiveReload?: () => Promise<void> }).__allureLiveReload?.(),
      );
      await expect(page.getByText("Late diagram", { exact: true })).toBeVisible();
    }).toPass();
    await new TestResultPage(page).toggleAttachmentByTitle("Late diagram");
    await expect(page.getByTestId("mermaid-attachment-preview")).toContainText("late directory viewer");
    const archive = await readReportStaticAssets(
      new URL("../../../plugin-awesome/dist/static/report.tar", import.meta.url),
    );
    const files = await readdir(join(output, "awesome"));
    expect(files.filter((name) => archive.files.has(name)).sort()).toEqual([...archive.files.keys()].sort());
  } finally {
    await server?.shutdown();
    await generation.done();
    await rm(root, { recursive: true, force: true });
  }
});

for (const singleFile of [false, true]) {
  test(`Dashboard replaces charts with an empty layout and restores them (singleFile=${singleFile})`, async ({
    page,
  }) => {
    const root = await mkdtemp(join(tmpdir(), "dashboard-empty-layout-"));
    const output = join(root, "report"),
      results = join(root, "results");
    await mkdir(results);
    await writeFile(
      join(results, "test-result.json"),
      JSON.stringify({
        uuid: "empty-layout",
        name: "passed",
        fullName: "empty-layout",
        status: "passed",
        start: 1000,
        stop: 1200,
      }),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400 && (response.url().includes("/widgets/") || response.url().endsWith(".js"))) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    const pie = [{ type: ChartType.CurrentStatus, title: "Restored pie" }] satisfies ChartOptions[];
    let server: Awaited<ReturnType<typeof serveReport>> | undefined;
    try {
      for (const layout of [pie, [], pie]) {
        await rm(output, { recursive: true, force: true });
        const report = new AllureReport({
          name: "Allure Report",
          open: false,
          port: undefined,
          output,
          reportFiles: new FileSystemReportFiles(output),
          appendHistory: false,
          plugins: [
            { id: "dashboard", enabled: true, options: {}, plugin: new DashboardPlugin({ layout, singleFile }) },
          ],
        });
        await report.start();
        await report.readDirectory(results);
        await report.done();
        server = await serveReport(output);
        await page.goto(server.url);
        // The grid exists only after the widget has loaded, including an empty grid.
        await expect(page.getByTestId("dashboard-charts")).toBeAttached();
        if (layout.length) {
          await expect(
            page.getByText("Restored pie", { exact: true }).locator("../..").locator("svg path").first(),
          ).toBeVisible();
        } else {
          await expect(page.getByText("Restored pie", { exact: true })).toHaveCount(0);
          await expect(page.getByText("Failed to fetch", { exact: false })).toHaveCount(0);
          if (!singleFile) {
            expect(JSON.parse(await readFile(join(output, "widgets/charts.json"), "utf8"))).toEqual({
              general: {},
              byEnv: {},
            });
            expect((await reportEntries(output)).some((file) => file.startsWith("chart-pie-"))).toBe(false);
          }
          await attachment("Empty Dashboard", await page.screenshot(), "image/png");
        }
        expect(errors).toEqual([]);
        await server.shutdown();
        server = undefined;
      }
    } finally {
      await server?.shutdown();
      await rm(root, { recursive: true, force: true });
    }
  });
}
