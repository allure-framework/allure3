import type { AllureStore, ReportFiles } from "@allurereport/plugin-api";
import { attachment, step, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { generateMetricsWidget, generateStaticFiles } from "../src/generators.js";
import { InMemoryDashboardDataWriter } from "../src/writer.js";

beforeEach(async () => {
  await story("index");
});

const createReportFiles = () => {
  const files = new Map<string, Buffer>();
  const reportFiles: ReportFiles = {
    addFile: async (path, data) => {
      files.set(path, data);
      return path;
    },
  };

  return { files, reportFiles };
};

describe("static report assets", () => {
  it("should restore the packaged archive for multi-file reports", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({
      allureVersion: "1.0.0",
      reportDataFiles: [],
      reportFiles,
      reportName: "Test report",
      reportUuid: "report-uuid",
    });

    const scriptFile = [...files.keys()].find((path) => path.endsWith(".js"));
    const indexHtml = files.get("index.html")?.toString("utf8") ?? "";

    expect(scriptFile).toBeDefined();
    expect(indexHtml).toContain(`src="${scriptFile}"`);
  });

  it("should embed the packaged bundle for single-file reports", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({
      allureVersion: "1.0.0",
      reportDataFiles: [],
      reportFiles,
      reportName: "Test report",
      reportUuid: "report-uuid",
      singleFile: true,
    });

    expect([...files.keys()]).toEqual(["index.html"]);
    expect(files.get("index.html")?.toString("utf8")).toContain("data:text/javascript;base64,");
  });
});

const metricsStore = (current: Awaited<ReturnType<AllureStore["allMetrics"]>>): AllureStore =>
  ({
    allMetrics: async () => current,
    allHistoryDataPoints: async () => [
      {
        uuid: "history-1",
        name: "main",
        timestamp: 1000,
        knownTestCaseIds: [],
        testResults: {},
        metrics: {
          "generate.total.avgMs": 200,
        },
        url: "https://example.com/report",
      },
      {
        uuid: "history-empty",
        name: "empty",
        timestamp: 2000,
        knownTestCaseIds: [],
        testResults: {},
        metrics: {},
      },
    ],
  }) as AllureStore;

describe("metrics widget", () => {
  it("skips metrics widget when there are no metric samples", async () => {
    const writer = new InMemoryDashboardDataWriter();

    await step("generate metrics widget from an empty metric set", async () => {
      await generateMetricsWidget(writer, metricsStore([]));
    });

    expect(writer.reportFiles()).toEqual([]);
  });

  it("writes metrics widget with current samples and history values", async () => {
    const writer = new InMemoryDashboardDataWriter();

    await step("generate metrics widget from current metric samples and history", async () => {
      await generateMetricsWidget(
        writer,
        metricsStore([
          {
            key: "generate.total.avgMs",
            value: 123,
            unit: "ms",
            source: "perf.json",
            better: "lower",
            display: { history: true },
          },
        ]),
      );
    });

    const [file] = writer.reportFiles();
    const payload = JSON.parse(Buffer.from(file.value, "base64").toString("utf8"));

    await attachment("metrics-widget.json", JSON.stringify(payload, null, 2), "application/json");

    expect(file.name).toBe("widgets/metrics.json");
    expect(payload.current).toEqual([
      {
        key: "generate.total.avgMs",
        value: 123,
        unit: "ms",
        source: "perf.json",
        better: "lower",
        display: { history: true },
      },
    ]);
    expect(payload.display).toEqual({ historyMetricKey: "generate.total.avgMs" });
    expect(payload.history).toEqual([
      {
        uuid: "history-1",
        name: "main",
        timestamp: 1000,
        metrics: {
          "generate.total.avgMs": 200,
        },
        url: "https://example.com/report",
      },
    ]);
  });
});
