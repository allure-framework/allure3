import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

import { ChartType, type ChartOptions } from "@allurereport/charts-api";
import { AllureReport, FileSystemReportFiles } from "@allurereport/core";
import { readReportStaticAssets } from "@allurereport/plugin-api/static-assets";
import AwesomePlugin from "@allurereport/plugin-awesome";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { expect, test, type Page } from "@playwright/test";
import { attachment, feature, label, Status, Stage } from "allure-js-commons";

import { TestResultPage } from "../pageObjects/index.js";
import { bootstrapReport, reportEntries, serveReport, type ReportBootstrap } from "../utils/index.js";

let report: ReportBootstrap | undefined;
test.beforeEach(async ({ browserName, page }) => {
  await feature("selective-single-file-assets");
  await label("env", browserName);
  await page.route("https://**/*", (route) => route.abort());
});
test.afterEach(async () => {
  await report?.shutdown();
  report = undefined;
});

const embeddedScripts = (html: string): Record<string, string> =>
  JSON.parse(html.match(/<script id="allure-single-file-assets" type="application\/json">([^<]+)<\/script>/)![1]);

const reportScripts = async (directory: string, singleFile: boolean): Promise<Record<string, string>> =>
  singleFile
    ? embeddedScripts(await readFile(join(directory, "index.html"), "utf8"))
    : Object.fromEntries(
        (await reportEntries(directory)).filter((file) => file.endsWith(".js")).map((file) => [file, file]),
      );

for (const frontend of ["awesome", "dashboard"] as const) {
  test(`${frontend} embeds only pie dependencies and renders offline in an Azure-style iframe`, async ({ page }) => {
    const charts = [{ type: ChartType.CurrentStatus, title: "Selected pie" }] satisfies ChartOptions[];
    report = await bootstrapReport({
      reportConfig: {
        appendHistory: false,
        plugins: [
          {
            id: frontend,
            enabled: true,
            options: {},
            plugin:
              frontend === "awesome"
                ? new AwesomePlugin({ singleFile: true, charts })
                : new DashboardPlugin({ singleFile: true, layout: charts }),
          },
        ],
      },
      testResults: [{ name: "passed", fullName: "selected-pie", status: Status.PASSED, start: 1000, stop: 1100 }],
    });
    const html = await readFile(join(report.reportDir, "index.html"), "utf8");
    const scripts = embeddedScripts(html);
    const archive = await readReportStaticAssets(
      new URL(`../../../plugin-${frontend}/dist/static/report.tar`, import.meta.url),
    );
    const graph = archive.featureAssets!;
    const selected = new Set([...graph.base, ...graph.features["chart-pie"]]);
    expect(Object.keys(scripts).sort()).toEqual([...selected].filter((file) => file.endsWith(".js")).sort());
    const licenses = JSON.parse(
      html.match(/<script id="allure-single-file-licenses" type="application\/json">([^<]+)<\/script>/)![1],
    ) as Record<string, string>;
    expect(Object.keys(licenses).sort()).toEqual([...selected].filter((file) => file.endsWith(".LICENSE.txt")).sort());
    for (const [file, content] of Object.entries(licenses))
      expect(content).toBe(archive.files.get(file)!.toString("utf8"));
    const decode = (encoded: string) =>
      frontend === "awesome" ? gunzipSync(Buffer.from(encoded, "base64")) : Buffer.from(encoded, "base64");
    const selectedBytes = Object.entries(scripts).reduce((sum, [name, value]) => {
      const content = decode(value);
      expect(content).toEqual(archive.files.get(name));
      return sum + content.length;
    }, 0);
    const fullBytes = [...archive.files]
      .filter(([name]) => name.endsWith(".js"))
      .reduce((sum, [, data]) => sum + data.length, 0);
    expect(selectedBytes).toBeLessThan(fullBytes);
    await attachment(
      "JavaScript selection",
      JSON.stringify(
        {
          frontend,
          selectedScripts: Object.keys(scripts).length,
          totalScripts: [...archive.files.keys()].filter((file) => file.endsWith(".js")).length,
          selectedBytes,
          fullBytes,
          htmlBytes: Buffer.byteLength(html),
        },
        null,
        2,
      ),
      "application/json",
    );
    expect(html).not.toContain("feature-assets.json");
    const errors: string[] = [],
      chunks: string[] = [];
    const observeScripts = (observedPage: Page) => {
      observedPage.on("pageerror", (error) => errors.push(error.message));
      observedPage.on("request", (request) => {
        if (request.resourceType() === "script" && !request.url().includes("googletagmanager"))
          chunks.push(request.url());
      });
    };
    observeScripts(page);
    // Establish an origin, then block external traffic before the report executes.
    await page.route(report.url, (route) =>
      route.fulfill({
        body: "<!doctype html><iframe title='Azure report' src='/azure-report-frame'></iframe>",
        contentType: "text/html",
      }),
    );
    await page.route("**/azure-report-frame", (route) =>
      route.fulfill({ body: "<!doctype html><html><head></head><body></body></html>", contentType: "text/html" }),
    );
    await page.goto(report.url);
    await page.context().setOffline(true);
    await page.evaluate(
      ({ html, frontend }) => {
        const frame = document.querySelector("iframe")!;
        if (frontend === "dashboard")
          Object.defineProperty(frame.contentWindow!, "DecompressionStream", { value: undefined });
        const doc = frame.contentDocument!;
        // Optional analytics is unrelated to chunk loading and Webpack publicPath.
        const parsed = new DOMParser().parseFromString(html, "text/html");
        for (const script of Array.from(parsed.querySelectorAll('script[src^="https:"]'))) script.remove();
        doc.open();
        doc.write("<!doctype html>" + parsed.documentElement.outerHTML);
        doc.close();
      },
      { html, frontend },
    );
    const frame = page.frameLocator('iframe[title="Azure report"]');
    if (frontend === "awesome") {
      await expect(frame.getByTestId("tree-leaf").first()).toBeVisible();
      await frame.locator("body").evaluate((body) => {
        body.ownerDocument.defaultView!.location.hash = "#/charts";
      });
    }
    const widget = frame.getByText("Selected pie", { exact: true }).locator("../..");
    await expect(widget.locator("svg path").first()).toBeVisible();
    expect(errors).toEqual([]);
    expect(chunks).toEqual([]);
    await page.context().setOffline(false);
    const filePage = await page.context().newPage();
    observeScripts(filePage);
    await filePage.route("https://**/*", (route) => route.abort());
    await filePage.goto(pathToFileURL(join(report.reportDir, "index.html")).href, { waitUntil: "domcontentloaded" });
    if (frontend === "awesome") {
      await expect(filePage.getByTestId("tree-leaf").first()).toBeVisible();
      await filePage.evaluate(() => {
        window.location.hash = "#/charts";
      });
    }
    await expect(
      filePage.getByText("Selected pie", { exact: true }).locator("../..").locator("svg path").first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
    expect(chunks).toEqual([]);
  });

  test(`${frontend} retains every embedded script for real-time generation`, async () => {
    report = await bootstrapReport({
      reportConfig: {
        realTime: true,
        appendHistory: false,
        plugins: [
          {
            id: frontend,
            enabled: true,
            options: {},
            plugin:
              frontend === "awesome"
                ? new AwesomePlugin({ singleFile: true, charts: [] })
                : new DashboardPlugin({ singleFile: true, layout: [] }),
          },
        ],
      },
      testResults: [{ name: "live", fullName: "live-snapshot", status: Status.PASSED }],
    });
    const archive = await readReportStaticAssets(
      new URL(`../../../plugin-${frontend}/dist/static/report.tar`, import.meta.url),
    );
    const scripts = embeddedScripts(await readFile(join(report.reportDir, "index.html"), "utf8"));
    expect(Object.keys(scripts).sort()).toEqual(
      [...archive.files.keys()].filter((name) => name.endsWith(".js")).sort(),
    );
  });
}

for (const singleFile of [true, false]) {
  test(`a Mermaid attachment present only in a failed retry remains available after selection (singleFile=${singleFile})`, async ({
    page,
  }) => {
    const base = {
      name: "Retry Mermaid",
      fullName: "retry-mermaid",
      historyId: "retry-mermaid",
      stage: Stage.FINISHED,
    };
    report = await bootstrapReport({
      reportConfig: {
        appendHistory: false,
        plugins: [{ id: "awesome", enabled: true, options: {}, plugin: new AwesomePlugin({ singleFile, charts: [] }) }],
      },
      rawTestResults: [
        {
          ...base,
          uuid: "failed",
          status: Status.FAILED,
          start: 1000,
          stop: 1100,
          steps: [
            {
              name: "failed attempt",
              statusDetails: {},
              steps: [],
              parameters: [],
              status: Status.FAILED,
              stage: Stage.FINISHED,
              attachments: [
                { name: "Retry diagram", source: "retry.mmd", type: "application/vnd.allure.diagrams.mermaid" },
              ],
            },
          ],
        },
        { ...base, uuid: "passed", status: Status.PASSED, start: 2000, stop: 2100 },
      ],
      attachments: [
        { source: "retry.mmd", content: Buffer.from("sequenceDiagram\nClient->>Server: retry attachment") },
      ],
    });
    const scripts = await reportScripts(report.reportDir, singleFile);
    expect(Object.keys(scripts).some((file) => file.startsWith("attachment-mermaid-"))).toBe(true);
    expect(Object.keys(scripts).some((file) => file.startsWith("attachment-code-"))).toBe(true);
    expect(Object.keys(scripts).some((file) => file.startsWith("chart-bar-"))).toBe(false);
    const archive = await readReportStaticAssets(
      new URL("../../../plugin-awesome/dist/static/report.tar", import.meta.url),
    );
    const scriptNames = Object.keys(scripts);
    const bytesUnder = async (directory: string): Promise<number> => {
      let total = 0;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        total += entry.isDirectory() ? await bytesUnder(path) : (await stat(path)).size;
      }
      return total;
    };
    await attachment(
      "Retry Mermaid asset sizes (same build, bytes)",
      JSON.stringify({
        scenario: "retry-mermaid",
        singleFile,
        fullJavaScriptBytes: [...archive.files]
          .filter(([file]) => file.endsWith(".js"))
          .reduce((sum, [, data]) => sum + data.length, 0),
        selectedJavaScriptBytes: scriptNames.reduce((sum, file) => sum + archive.files.get(file)!.length, 0),
        fullScripts: [...archive.files.keys()].filter((file) => file.endsWith(".js")).length,
        selectedScripts: scriptNames.length,
        reportBytes: await bytesUnder(report.reportDir),
        singleFileHtmlBytes: singleFile ? (await stat(join(report.reportDir, "index.html"))).size : undefined,
      }),
      "application/json",
    );
    await page.goto(report.url);
    await page.getByText("Retry Mermaid", { exact: true }).click();
    await page.getByRole("button", { name: "Retries" }).click();
    await page.getByTestId("test-result-retries-item-open-button").click();
    const result = new TestResultPage(page);
    await result.ensureBodyStepsOpened();
    await result.expandStepByTitle("failed attempt");
    await result.toggleAttachmentByTitle("Retry diagram");
    await expect(page.getByText("retry attachment", { exact: true }).first()).toBeVisible();
  });

  test(`a comparison present only in history remains available (singleFile=${singleFile})`, async ({
    page,
    context,
  }) => {
    report = await bootstrapReport({
      reportConfig: {
        appendHistory: false,
        plugins: [{ id: "awesome", enabled: true, options: {}, plugin: new AwesomePlugin({ singleFile, charts: [] }) }],
      },
      rawTestResults: [
        {
          uuid: "current",
          name: "Historical comparison",
          fullName: "history-only-diff",
          historyId: "history-only-diff",
          status: Status.PASSED,
        },
      ],
      history: [
        {
          uuid: "previous-run",
          name: "previous",
          timestamp: 1000,
          knownTestCaseIds: [],
          metrics: {},
          url: "",
          testResults: {
            "history-only-diff": {
              id: "previous",
              name: "Historical comparison",
              status: "failed",
              url: "",
              error: { expected: "old history value", actual: "new history value" },
            },
          },
        },
      ],
    });
    const scripts = await reportScripts(report.reportDir, singleFile);
    expect(Object.keys(scripts).some((file) => file.startsWith("error-diff-"))).toBe(true);
    expect(Object.keys(scripts).some((file) => file.startsWith("attachment-mermaid-"))).toBe(false);
    await page.goto(report.url);
    if (singleFile) await context.setOffline(true);
    await page.getByText("Historical comparison", { exact: true }).click();
    await new TestResultPage(page).tabById("history").click();
    await page.getByRole("button", { name: "toggle history error" }).click();
    await page.getByTestId("test-result-diff-button").click();
    await expect(page.getByTestId("test-result-diff")).toContainText("old history value");
    await expect(page.getByTestId("test-result-diff")).toContainText("new history value");
  });

  test(`dump-only restoration retains fixture viewers in a regenerated report (singleFile=${singleFile})`, async ({
    page,
  }) => {
    const root = await mkdtemp(join(tmpdir(), "selective-dump-"));
    try {
      const plugins = () => [
        { id: "awesome", enabled: true, options: {}, plugin: new AwesomePlugin({ singleFile, charts: [] }) },
      ];
      report = await bootstrapReport({
        reportConfig: { appendHistory: false, dump: join(root, "snapshot"), plugins: plugins() },
        rawTestResults: [
          { uuid: "fixture-test", name: "Dump fixture", fullName: "dump-fixture", status: Status.PASSED },
        ],
        rawTestResultContainers: [
          {
            uuid: "fixture-container",
            children: ["fixture-test"],
            befores: [
              {
                name: "fixture setup",
                status: "passed",
                attachments: [
                  { name: "Fixture diagram", source: "fixture.mmd", type: "application/vnd.allure.diagrams.mermaid" },
                ],
              },
            ],
          },
        ],
        attachments: [
          { source: "fixture.mmd", content: Buffer.from("sequenceDiagram\nClient->>Server: restored fixture") },
        ],
      });
      const newReport = () =>
        new AllureReport({
          name: "Allure Report",
          open: false,
          port: undefined,
          output: report!.reportDir,
          reportFiles: new FileSystemReportFiles(report!.reportDir),
          appendHistory: false,
          plugins: plugins(),
        });
      await rm(report.reportDir, { recursive: true, force: true });
      const baseline = newReport();
      await baseline.start();
      await baseline.done();
      const original = await reportScripts(report.reportDir, singleFile);
      expect(Object.keys(original).some((file) => file.startsWith("attachment-mermaid-"))).toBe(false);
      await rm(report.reportDir, { recursive: true, force: true });
      const restored = newReport();
      await restored.start();
      await restored.restoreState([join(root, "snapshot.zip")]);
      await restored.done();
      const scripts = await reportScripts(report.reportDir, singleFile);
      expect(Object.keys(scripts).some((file) => file.startsWith("attachment-mermaid-"))).toBe(true);
      expect(Object.keys(scripts).some((file) => file.startsWith("attachment-code-"))).toBe(true);
      expect(Object.keys(scripts).some((file) => file.startsWith("chart-bar-"))).toBe(false);
      await page.goto(report.url);
      if (singleFile) await page.context().setOffline(true);
      await page.getByText("Dump fixture", { exact: true }).click();
      const result = new TestResultPage(page);
      await result.expandStepByTitle("fixture setup");
      await result.toggleAttachmentByTitle("Fixture diagram");
      await expect(page.getByTestId("mermaid-attachment-preview")).toContainText("restored fixture");
      await rm(report.reportDir, { recursive: true, force: true });
      const reduced = newReport();
      await reduced.start();
      await reduced.done();
      expect(await reportScripts(report.reportDir, singleFile)).toEqual(original);
      // An already opened immutable snapshot keeps its own embedded viewers.
      if (singleFile) await expect(page.getByTestId("mermaid-attachment-preview")).toContainText("restored fixture");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("live generation keeps viewers for attachments arriving after the page opens", async ({ page }) => {
  const root = await mkdtemp(join(tmpdir(), "selective-live-"));
  const reportDir = join(root, "report");
  const resultsDir = join(root, "results");
  await mkdir(resultsDir);
  const generation = new AllureReport({
    name: "Allure Report",
    open: false,
    port: undefined,
    realTime: true,
    appendHistory: false,
    output: reportDir,
    reportFiles: new FileSystemReportFiles(reportDir),
    plugins: [
      { id: "awesome", enabled: true, options: {}, plugin: new AwesomePlugin({ singleFile: true, charts: [] }) },
    ],
  });
  let server: Awaited<ReturnType<typeof serveReport>> | undefined;
  let stopped = false;
  try {
    await generation.start();
    const initial = embeddedScripts(await readFile(join(reportDir, "awesome", "index.html"), "utf8"));
    const archive = await readReportStaticAssets(
      new URL("../../../plugin-awesome/dist/static/report.tar", import.meta.url),
    );
    expect(Object.keys(initial).sort()).toEqual(
      [...archive.files.keys()].filter((file) => file.endsWith(".js")).sort(),
    );
    server = await serveReport(join(reportDir, "awesome"));
    await page.goto(server.url);
    await expect(page.getByTestId("tree-leaf")).toHaveCount(0);
    await writeFile(join(resultsDir, "late.mmd"), "sequenceDiagram\nClient->>Server: late attachment");
    await writeFile(
      join(resultsDir, "late-result.json"),
      JSON.stringify({
        uuid: "late",
        name: "Late diagram",
        fullName: "late-diagram",
        status: "passed",
        attachments: [{ name: "Late Mermaid", source: "late.mmd", type: "application/vnd.allure.diagrams.mermaid" }],
      }),
    );
    await generation.readDirectory(resultsDir);
    // Single-file clients consume a complete new HTML snapshot on full reload.
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("tree-leaf").filter({ hasText: "Late diagram" })).toBeVisible();
    }).toPass({ timeout: 10000 });
    expect(embeddedScripts(await readFile(join(reportDir, "awesome", "index.html"), "utf8"))).toEqual(initial);
    await page.context().setOffline(true);
    await page.getByText("Late diagram", { exact: true }).click();
    await new TestResultPage(page).toggleAttachmentByTitle("Late Mermaid");
    await expect(page.getByTestId("mermaid-attachment-preview")).toContainText("late attachment");
    await generation.done();
    stopped = true;
    expect(embeddedScripts(await readFile(join(reportDir, "index.html"), "utf8"))).toEqual(initial);
  } finally {
    if (!stopped) await generation.done();
    await server?.shutdown();
    await rm(root, { recursive: true, force: true });
  }
});
