import { CiType } from "@allurereport/core-api";
import type { AllureStore, ReportFiles } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { generatePieChart, generateStaticFiles } from "../src/generators.js";
import { collectOverviewOptions } from "../src/overview.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-classic");
  await story("overview");
  await label("coverage", "plugin-classic");
});

const readReportOptions = (html: string) => {
  const match = /window\.allureReportOptions = (.*)\n/.exec(html);

  return JSON.parse(match?.[1] ?? "{}");
};

describe("collectOverviewOptions", () => {
  it("should read the executor from the store and keep the ci and git information", async () => {
    const executor = { name: "Jenkins", type: "jenkins", buildName: "#12", buildUrl: "https://ci.example.com/12" };
    const store = { metadataByKey: vi.fn().mockResolvedValue(executor) } as unknown as AllureStore;
    const ci = { type: CiType.Github, detected: true, jobName: "build" } as any;

    const result = await collectOverviewOptions({ ci }, store, [{ start: 10, stop: 30 }], () => ({
      commit: "abcdef1234567",
      branch: "main",
    }));

    expect(store.metadataByKey).toHaveBeenCalledWith("allure2_executor");
    expect(result).toEqual({
      ci,
      executor,
      git: { commit: "abcdef1234567", branch: "main" },
      runSummary: { start: 10, stop: 30, duration: 20 },
    });
  });

  it("should leave out the executor when there is none", async () => {
    const store = { metadataByKey: vi.fn().mockResolvedValue(undefined) } as unknown as AllureStore;

    const result = await collectOverviewOptions({}, store, [], () => undefined);

    expect(result).toEqual({ ci: undefined, git: undefined, executor: undefined, runSummary: undefined });
  });
});

describe("generateStaticFiles overview options", () => {
  it("should put the executor, ci, git and run summary into the report options", async () => {
    const files = new Map<string, Buffer>();
    const reportFiles: ReportFiles = {
      addFile: async (path, data) => {
        files.set(path, data);
        return path;
      },
    };

    await generateStaticFiles({
      allureVersion: "1.0.0",
      reportDataFiles: [],
      reportFiles,
      reportName: "Test report",
      reportUuid: "report-uuid",
      ci: { type: CiType.Github, detected: true, jobRunName: "run 1" } as any,
      git: { commit: "abc", branch: "main" },
      executor: { name: "Jenkins", buildName: "#12" },
      runSummary: { start: 1, stop: 3, duration: 2 },
    });

    const reportOptions = readReportOptions(files.get("index.html")?.toString("utf8") ?? "");

    expect(reportOptions).toMatchObject({
      reportName: "Test report",
      ci: { type: CiType.Github, jobRunName: "run 1" },
      git: { commit: "abc", branch: "main" },
      executor: { name: "Jenkins", buildName: "#12" },
      runSummary: { start: 1, stop: 3, duration: 2 },
    });
  });
});

describe("generatePieChart", () => {
  it("should show passed out of all tests in the summary ring as Allure 2 does", async () => {
    const writeWidget = vi.fn();
    const statistic = { total: 676, passed: 390, failed: 121, broken: 110, skipped: 50, unknown: 5 };

    await generatePieChart({ writeWidget } as any, statistic);

    const [fileName, chart] = writeWidget.mock.calls[0];

    expect(fileName).toBe("allure_pie_chart.json");
    expect(chart.percentage).toBe(57.69);
    expect(chart.slices.reduce((sum: number, slice: { count: number }) => sum + slice.count, 0)).toBe(676);
  });
});
