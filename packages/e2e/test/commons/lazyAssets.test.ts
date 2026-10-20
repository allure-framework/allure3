import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ChartType, type ChartOptions } from "@allurereport/charts-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import ClassicPlugin from "@allurereport/plugin-classic";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { expect, test, type Page } from "@playwright/test";
import { feature, label, Stage, Status } from "allure-js-commons";

import { TestResultPage, TreePage } from "../pageObjects/index.js";
import { bootstrapReport, type ReportBootstrap } from "../utils/index.js";

let report: ReportBootstrap;

test.beforeEach(async ({ page, browserName }) => {
  await feature("lazy-report-components");
  await label("env", browserName);
  await page.route("https://**/*", (route) => route.abort());
});

test.afterEach(async () => {
  await report?.shutdown();
});

// Remove the external script element too: Webpack's auto publicPath can inspect
// its src even when the request itself is blocked.
const removeExternalScripts = async (page: Page) => {
  const file = join(report.reportDir, "index.html");
  const html = await readFile(file, "utf8");
  const localHtml = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, "text/html");
    for (const script of document.querySelectorAll('script[src^="http:"], script[src^="https:"]')) {
      script.remove();
    }
    return "<!doctype html>" + document.documentElement.outerHTML;
  }, html);
  await writeFile(file, localHtml);
};

for (const frontend of ["awesome", "dashboard"] as const) {
  test(`${frontend} single-file renders a chart without external scripts or chunk requests`, async ({
    page,
    context,
  }) => {
    const charts: ChartOptions[] = [
      { type: ChartType.CurrentStatus, title: "Selected pie" },
      { type: ChartType.StatusDynamics, title: "Selected bar" },
      { type: ChartType.SuccessRateDistribution, title: "Selected treemap" },
      { type: ChartType.ProblemsDistribution, by: "environment", title: "Selected heatmap" },
      { type: ChartType.TestingPyramid, title: "Selected funnel" },
    ];
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
      testResults: [{ name: "passed", fullName: "selected-chart", status: Status.PASSED, start: 1000, stop: 1100 }],
    });
    await removeExternalScripts(page);
    const scripts: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    // Establish the report origin without executing application code, then parse
    // the report document offline. Firefox rejects routed offline navigations.
    await page.route(report.url, (route) =>
      route.fulfill({ body: "<!doctype html><html></html>", contentType: "text/html" }),
    );
    await page.goto(report.url);
    await context.setOffline(true);
    if (frontend === "dashboard") {
      await page.evaluate(() => Object.defineProperty(window, "DecompressionStream", { value: undefined }));
    }
    await page.setContent(await readFile(join(report.reportDir, "index.html"), "utf8"));
    if (frontend === "awesome") {
      await expect(page.getByTestId("tree-leaf").first()).toBeVisible();
      await page.goto(new URL("#/charts", report.url).href);
    }
    for (const chart of charts) {
      await expect(page.getByText(chart.title!, { exact: true })).toBeAttached();
    }
    await expect(page.getByText("Selected pie", { exact: true })).toBeVisible();
    const widget = page.getByText("Selected pie", { exact: true }).locator("../..");
    await expect(widget.locator("svg path").first()).toBeVisible();
    expect(scripts).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const singleFile of [false, true]) {
  test(`classic shared charts render in ${singleFile ? "offline single-file" : "directory"} output`, async ({
    page,
    context,
  }) => {
    report = await bootstrapReport({
      reportConfig: {
        appendHistory: false,
        plugins: [{ id: "classic", enabled: true, options: {}, plugin: new ClassicPlugin({ singleFile }) }],
      },
      testResults: [
        { name: "passed", fullName: "classic-shared-charts", status: Status.PASSED, start: 1000, stop: 1100 },
      ],
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (singleFile) {
      await removeExternalScripts(page);
      await page.route(report.url, (route) =>
        route.fulfill({ body: "<!doctype html><html></html>", contentType: "text/html" }),
      );
      await page.goto(report.url);
      await context.setOffline(true);
      await page.setContent(await readFile(join(report.reportDir, "index.html"), "utf8"));
    } else {
      await page.goto(report.url);
    }
    await page.goto(new URL("#overview", report.url).href);
    for (const title of [
      "Current status",
      "Status dynamics",
      "Success rate distribution",
      "Problems distribution by environment",
      "Testing pyramid",
    ]) {
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }
    const widget = page.getByText("Current status", { exact: true }).first().locator("../..");
    await expect(widget.locator("svg path").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const singleFile of [false, true]) {
  test(`lazy attachment renderers and retry comparison execute in ${singleFile ? "single-file" : "directory"} output`, async ({
    page,
    context,
  }) => {
    const source = "# Selected Markdown\n\n**source remains available**";
    const image = await readFile(new URL("../fixtures/image.png", import.meta.url));
    const imageData = `data:image/png;base64,${image.toString("base64")}`;
    const attachments = [
      { name: "Diagram", source: "sequence.mmd", type: "application/vnd.allure.diagrams.mermaid" },
      { name: "Notes", source: "notes.md", type: "text/markdown" },
      { name: "Rows", source: "rows.csv", type: "text/csv" },
      { name: "Exchange", source: "exchange.json", type: "application/vnd.allure.http+json" },
      { name: "Pixels", source: "pixels.json", type: "application/vnd.allure.image.diff" },
    ];
    const base = {
      name: "selected attachments",
      fullName: "selected-attachments",
      historyId: "selected-attachments",
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
          uuid: "failed-attempt",
          status: Status.FAILED,
          start: 1000,
          stop: 1100,
          statusDetails: { message: "Expected: expected-value\nReceived: actual-value" },
        },
        {
          ...base,
          uuid: "passed-attempt",
          status: Status.PASSED,
          start: 2000,
          stop: 2100,
          steps: [
            {
              name: "attachments",
              status: Status.PASSED,
              stage: Stage.FINISHED,
              parameters: [],
              steps: [],
              statusDetails: {},
              attachments,
            },
          ],
        },
      ],
      attachments: [
        {
          source: "sequence.mmd",
          content: Buffer.from(
            "sequenceDiagram\nClient->>Server: Selected request\nServer-->>Client: Selected response",
          ),
        },
        { source: "notes.md", content: Buffer.from(source) },
        { source: "rows.csv", content: Buffer.from("Name,Value\nSelected row,42") },
        {
          source: "exchange.json",
          content: Buffer.from(
            JSON.stringify({
              schemaVersion: 1,
              request: { method: "GET", url: "https://example.test/selected-exchange", headers: [] },
              response: { status: 200, statusText: "OK", headers: [] },
            }),
          ),
        },
        {
          source: "pixels.json",
          content: Buffer.from(
            JSON.stringify(Object.fromEntries(["expected", "actual", "diff"].map((key) => [key, imageData]))),
          ),
        },
      ],
    });
    await removeExternalScripts(page);
    const scripts: string[] = [];
    const failures: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });
    page.on("response", (response) => {
      if (response.request().resourceType() === "script" && !response.ok()) failures.push(response.url());
    });
    page.on("requestfailed", (request) => {
      if (request.resourceType() === "script") failures.push(request.url());
    });
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto(report.url);
    const tree = new TreePage(page);
    const result = new TestResultPage(page);
    await expect(tree.getLeafByTitle(base.name)).toBeVisible();
    expect(scripts.filter((url) => /attachment-|error-diff-|chart-/.test(url))).toEqual([]);
    if (singleFile) await context.setOffline(true);
    await tree.clickLeafByTitle(base.name);
    await result.ensureBodyStepsOpened();
    await result.expandStepByTitle("attachments");
    expect(scripts.filter((url) => /attachment-|error-diff-/.test(url))).toEqual([]);
    await result.toggleAttachmentByTitle("Diagram");
    await expect(page.getByTestId("mermaid-attachment-preview")).toContainText("Selected response");
    await result.toggleAttachmentByTitle("Notes");
    const notes = result.testResultAttachmentLocator.filter({ has: page.getByText("Notes", { exact: true }) });
    await expect(
      notes.frameLocator('iframe[title="Markdown attachment"]').getByRole("heading", { name: "Selected Markdown" }),
    ).toBeVisible();
    await expect(notes.locator('iframe[title="Markdown attachment"]')).toHaveAttribute("sandbox", "allow-same-origin");
    await expect(notes.locator('iframe[title="Markdown attachment"]')).toHaveAttribute("height", /^[1-9]\d*$/);
    await notes.locator('button[aria-pressed="false"]').click();
    await expect(notes.getByTestId("code-attachment-content")).toBeVisible();
    await expect(notes.getByTestId("code-attachment-content")).toContainText(source);

    await result.toggleAttachmentByTitle("Rows");
    await expect(
      page.getByTestId("table-attachment-content").getByRole("cell", { name: "Selected row", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("table-attachment-content").getByRole("cell", { name: "42", exact: true }),
    ).toBeVisible();
    await result.toggleAttachmentByTitle("Exchange");
    await expect(page.getByTestId("http-attachment-content")).toContainText("https://example.test/selected-exchange");
    await expect(page.getByTestId("http-attachment-content")).toContainText("200 OK");
    await expect(page.getByTestId("http-attachment-content").locator("[data-http-method]")).toHaveText("GET");
    await result.toggleAttachmentByTitle("Pixels");
    const pixels = result.testResultAttachmentLocator.filter({ has: page.getByText("Pixels", { exact: true }) });
    await expect(pixels.locator("img").first()).toBeVisible();
    await expect
      .poll(() =>
        pixels
          .locator("img")
          .first()
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBe(image.readUInt32BE(16));
    await result.tabById("retries").click();
    await result.getRetry(0).toggleDetails();
    await page.getByTestId("test-result-diff-button").click();
    await expect(page.getByTestId("test-result-diff")).toContainText("expected-value");
    await expect(page.getByTestId("test-result-diff")).toContainText("actual-value");
    expect(failures).toEqual([]);
    if (singleFile) expect(scripts).toEqual([]);
    else expect(scripts.some((url) => url.includes("attachment-mermaid"))).toBe(true);
  });
}

test("a failed chart chunk shows the translated empty view and keeps the report usable", async ({ page }) => {
  report = await bootstrapReport({
    reportConfig: {
      appendHistory: false,
      plugins: [
        {
          id: "awesome",
          enabled: true,
          options: {},
          plugin: new AwesomePlugin({
            charts: [{ type: ChartType.CurrentStatus, title: "Selected pie" }],
          }),
        },
      ],
    },
    testResults: [{ name: "passed", fullName: "failed-chart-chunk", status: Status.PASSED, start: 1000, stop: 1100 }],
  });
  await removeExternalScripts(page);
  let requests = 0;
  await page.route("**/chart-pie-*.js", (route) => {
    requests++;
    return requests === 1 ? route.fulfill({ status: 404, body: "missing chunk" }) : route.continue();
  });
  await page.goto(new URL("#/charts", report.url).href);
  await expect(page.getByText("Failed to load chart", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Selected pie", { exact: true })).toBeVisible();
  await expect(page.getByText("Failed to load chart", { exact: true })).toHaveCount(0);
  expect(requests).toBe(2);
  await page.goto(new URL("#/", report.url).href);
  await new TreePage(page).clickLeafByTitle("passed");
  await expect(new TestResultPage(page).titleLocator).toHaveText("passed");
});

test("retries the same attachment and comparison chunks after one failed request", async ({ page }) => {
  report = await bootstrapReport({
    reportConfig: {
      appendHistory: false,
      plugins: [{ id: "awesome", enabled: true, options: {}, plugin: new AwesomePlugin({ charts: [] }) }],
    },
    rawTestResults: [
      {
        uuid: "retry-chunks",
        name: "retry chunks",
        fullName: "retry-chunks",
        status: Status.FAILED,
        stage: Stage.FINISHED,
        start: 1000,
        stop: 1100,
        statusDetails: { message: "Expected: expected-value\nReceived: actual-value" },
        steps: [
          {
            name: "attachments",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            parameters: [],
            steps: [],
            statusDetails: {},
            attachments: [
              { name: "First text", source: "first.txt", type: "text/plain" },
              { name: "Second text", source: "second.txt", type: "text/plain" },
            ],
          },
        ],
      },
    ],
    attachments: [
      { source: "first.txt", content: Buffer.from("first recovered source"), contentType: "text/plain" },
      { source: "second.txt", content: Buffer.from("second recovered source"), contentType: "text/plain" },
    ],
  });
  await removeExternalScripts(page);
  const requests = { code: 0, comparison: 0 };
  await page.route("**/attachment-code-*.js", (route) => {
    requests.code++;
    return requests.code === 1 ? route.fulfill({ status: 503, body: "temporary failure" }) : route.continue();
  });
  await page.route("**/error-diff-*.js", (route) => {
    requests.comparison++;
    return requests.comparison === 1 ? route.fulfill({ status: 503, body: "temporary failure" }) : route.continue();
  });
  await page.goto(report.url);
  await new TreePage(page).clickLeafByTitle("retry chunks");
  const result = new TestResultPage(page);
  await result.ensureBodyStepsOpened();
  await result.expandStepByTitle("attachments");
  expect(requests).toEqual({ code: 0, comparison: 0 });
  await result.toggleAttachmentByTitle("First text");
  await expect(page.getByText("Failed to load attachment viewer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("code-attachment-content")).toContainText("first recovered source");
  expect(requests.code).toBe(2);
  await result.toggleAttachmentByTitle("First text");
  await result.toggleAttachmentByTitle("Second text");
  const second = result.testResultAttachmentLocator.filter({ has: page.getByText("Second text", { exact: true }) });
  await expect(second.getByTestId("code-attachment-content")).toContainText("second recovered source");
  expect(requests.code).toBe(2);
  await page.getByTestId("test-result-diff-button").first().click();
  await expect(page.getByText("Failed to load comparison", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("test-result-diff")).toContainText("actual-value");
  await expect(page.getByTestId("test-result-diff")).toContainText("expected-value");
  expect(requests.comparison).toBe(2);
});
