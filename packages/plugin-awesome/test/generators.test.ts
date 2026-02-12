/* eslint-disable @typescript-eslint/unbound-method */
import { ChartType } from "@allurereport/charts-api";
import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { describe, expect, it, vi } from "vitest";
import { generateAllCharts } from "../src/generators.js";
import type { AwesomeDataWriter } from "../src/writer.js";

const getTestResultsStats = (trs: TestResult[], filter: (tr: TestResult) => boolean = () => true) => {
  const trsToProcess = trs.filter(filter);

  return trsToProcess.reduce(
    (acc, test) => {
      if (!acc[test.status]) {
        acc[test.status] = 0;
      }
      acc[test.status]++;
      return acc;
    },
    { total: trsToProcess.length } as Record<string, number>,
  );
};

const mockTestResult = (id: string, name: string, status: TestResult["status"]): TestResult =>
  ({
    id,
    name,
    status,
    labels: [],
    flaky: false,
    muted: false,
    known: false,
    hidden: false,
    sourceMetadata: { readerId: "system", metadata: {} },
    parameters: [],
    links: [],
    steps: [],
  }) as TestResult;

describe("generateAllCharts", () => {
  it("should filter chart data when filter is passed in options", async () => {
    const testResults: TestResult[] = [
      mockTestResult("tr-1", "passed test", "passed"),
      mockTestResult("tr-2", "failed test", "failed"),
      mockTestResult("tr-3", "another passed test", "passed"),
    ];

    const writtenWidgets = new Map<string, unknown>();
    const writer: AwesomeDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn(async (fileName: string, data: unknown) => {
        writtenWidgets.set(fileName, data);
      }),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };

    const store: AllureStore = {
      metadataByKey: vi.fn().mockResolvedValue(undefined),
      allEnvironments: vi.fn().mockResolvedValue(["default"]),
      allAttachments: vi.fn().mockResolvedValue([]),
      allTestResults: vi.fn().mockResolvedValue(testResults),
      testsStatistic: vi.fn(async (filter: (tr: TestResult) => boolean) => getTestResultsStats(testResults, filter)),
      allTestEnvGroups: vi.fn().mockResolvedValue([]),
      allGlobalAttachments: vi.fn().mockResolvedValue([]),
      globalExitCode: vi.fn().mockResolvedValue(undefined),
      allGlobalErrors: vi.fn().mockResolvedValue([]),
      qualityGateResults: vi.fn().mockResolvedValue([]),
      fixturesByTrId: vi.fn().mockResolvedValue([]),
      historyByTrId: vi.fn().mockResolvedValue([]),
      retriesByTrId: vi.fn().mockResolvedValue([]),
      attachmentsByTrId: vi.fn().mockResolvedValue([]),
      allVariables: vi.fn().mockResolvedValue([]),
      envVariables: vi.fn().mockResolvedValue([]),
      allHistoryDataPoints: vi.fn().mockResolvedValue([]),
      allNewTestResults: vi.fn().mockResolvedValue([]),
      attachmentContentById: vi.fn().mockResolvedValue(undefined),
    } as unknown as AllureStore;

    const context: PluginContext = {
      id: "Awesome",
      publish: true,
      state: {} as PluginContext["state"],
      allureVersion: "3.0.0",
      reportUuid: "report-uuid",
      reportName: "Test report",
      reportFiles: {} as PluginContext["reportFiles"],
      output: "/tmp/out",
    };

    await generateAllCharts(writer, store, { filter: (tr) => tr.status === "passed" }, context);

    expect(writer.writeWidget).toHaveBeenCalledWith("charts.json", expect.any(Object));

    interface ChartItem {
      type: string;
      data: Record<string, number>;
    }
    const chartsData = writtenWidgets.get("charts.json") as { general: Record<string, ChartItem> };
    expect(chartsData).toBeDefined();
    expect(chartsData.general).toBeDefined();

    // Find Current Status chart (uses statistic as data); filtered results should show only passed
    const chartEntries = Object.values(chartsData.general);
    const currentStatusChart = chartEntries.find((chart) => chart.type === ChartType.CurrentStatus);
    expect(currentStatusChart).toBeDefined();
    expect(currentStatusChart!.data).toEqual({
      passed: 2,
      total: 2,
    });
    // Failed test must be excluded by filter
    expect(currentStatusChart!.data.failed).toBeUndefined();
  });
});
