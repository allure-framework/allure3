import { ChartType, defaultChartsConfig } from "@allurereport/charts-api";
import type { TestFixtureResult, TestResult } from "@allurereport/core-api";
import { normalizeCategoriesConfig } from "@allurereport/core-api";
import type { AllureStore, ReportFiles, ReportTestResult, ReportTreeGroup } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { resolveClassicCategories } from "../src/categories.js";
import {
  classicChartsConfig,
  generateStaticFiles,
  generateTestResults,
  generateTreeByCategories,
} from "../src/generators.js";
import type { ClassicDataWriter } from "../src/writer.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("generators");
  await label("coverage", "report-output");
});

const mockTestResult = (id: string, name: string, status: TestResult["status"]): TestResult =>
  ({
    id,
    name,
    status,
    labels: [],
    flaky: false,
    muted: false,
    known: false,
    isRetry: false,
    sourceMetadata: { readerId: "system", metadata: {} },
    parameters: [],
    links: [],
    steps: [],
  }) as TestResult;

const mockFixtureResult = (
  id: string,
  type: TestFixtureResult["type"],
  name: string,
  start: number,
): TestFixtureResult =>
  ({
    id,
    testResultIds: ["tr-1"],
    type,
    name,
    status: "passed",
    start,
    duration: 1,
    steps: [],
    sourceMetadata: { readerId: "system", metadata: {} },
  }) as TestFixtureResult;

describe("generateTestResults", () => {
  it("should sort setup and teardown fixtures by start time", async () => {
    const testResult = mockTestResult("tr-1", "test", "passed");
    const writer: ClassicDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeRawData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const store = {
      allTestResults: vi.fn().mockResolvedValue([testResult]),
      metadataByKey: vi.fn().mockResolvedValue(undefined),
      relatedByTestResultIds: vi.fn().mockResolvedValue({
        attachmentsByTrId: new Map([["tr-1", []]]),
        fixturesByTrId: new Map([
          [
            "tr-1",
            [
              mockFixtureResult("before-each", "before", "beforeEach", 200),
              mockFixtureResult("before-all", "before", "beforeAll", 100),
              mockFixtureResult("after-all", "after", "afterAll", 400),
              mockFixtureResult("after-each", "after", "afterEach", 300),
            ],
          ],
        ]),
        historyByTrId: new Map([["tr-1", []]]),
        retriesByTrId: new Map([["tr-1", []]]),
      }),
    } as unknown as AllureStore;

    const [converted] = await generateTestResults(writer, store);

    expect(converted?.setup.map(({ name }) => name)).toEqual(["beforeAll", "beforeEach"]);
    expect(converted?.teardown.map(({ name }) => name)).toEqual(["afterEach", "afterAll"]);
  });
});

const createWriter = (): ClassicDataWriter => ({
  writeData: vi.fn().mockResolvedValue(undefined),
  writeWidget: vi.fn().mockResolvedValue(undefined),
  writeTestCase: vi.fn().mockResolvedValue(undefined),
  writeAttachment: vi.fn().mockResolvedValue(undefined),
});

const createStore = (testResults: TestResult[]) =>
  ({
    allTestResults: vi.fn(async ({ filter }: { filter?: (tr: TestResult) => boolean } = {}) =>
      filter ? testResults.filter(filter) : testResults,
    ),
    metadataByKey: vi.fn().mockResolvedValue(undefined),
    relatedByTestResultIds: vi.fn().mockResolvedValue({
      attachmentsByTrId: new Map(),
      fixturesByTrId: new Map(),
      historyByTrId: new Map(),
      retriesByTrId: new Map(),
    }),
  }) as unknown as AllureStore;

const withError = (tr: TestResult, message?: string, trace?: string): TestResult => ({
  ...tr,
  error: { message, trace },
});

describe("generateTestResults categories and filter", () => {
  it("should apply the filter option to the test results", async () => {
    const store = createStore([mockTestResult("tr-1", "kept", "passed"), mockTestResult("tr-2", "dropped", "failed")]);
    const writer = createWriter();

    const converted = await generateTestResults(writer, store, { filter: (tr) => tr.name === "kept" });

    expect(store.allTestResults).toHaveBeenCalledWith(expect.objectContaining({ filter: expect.any(Function) }));
    expect(converted.map(({ name }) => name)).toEqual(["kept"]);
    expect(writer.writeWidget).toHaveBeenCalledWith("nav.json", ["tr-1"]);
  });

  it("should store the matched category in the test result data using the real error fields", async () => {
    const categories = resolveClassicCategories(
      normalizeCategoriesConfig([{ name: "Timeouts", messageRegex: ".*timed out.*" }]),
      [{ name: "Network", traceRegex: ".*ECONNREFUSED.*" }],
    );
    const store = createStore([
      withError(mockTestResult("tr-1", "timeout", "failed"), "Request timed out"),
      withError(mockTestResult("tr-2", "network", "broken"), "fetch failed", "Error\n  cause: ECONNREFUSED"),
      withError(mockTestResult("tr-3", "assertion", "failed"), "expected 1 to be 2"),
      mockTestResult("tr-4", "passed", "passed"),
    ]);

    const converted = await generateTestResults(createWriter(), store, { categories });
    const byName = Object.fromEntries(converted.map((tr) => [tr.name, tr.categories?.map(({ name }) => name)]));

    expect(byName).toEqual({
      timeout: ["Timeouts"],
      network: ["Network"],
      assertion: ["Product defects"],
      passed: [],
    });
  });
});

describe("generateTreeByCategories", () => {
  const reportTr = (id: string, status: ReportTestResult["status"], categories: string[], message?: string) =>
    ({
      id,
      name: id,
      status,
      flaky: false,
      isRetry: false,
      retries: [],
      categories: categories.map((name) => ({ name })),
      error: message ? { message } : undefined,
    }) as unknown as ReportTestResult;

  it("should build category -> message -> test tree without uncategorized tests", async () => {
    const writer = createWriter();

    await generateTreeByCategories(writer, "categories", [
      reportTr("failed-1", "failed", ["Product defects"], "boom"),
      reportTr("failed-2", "failed", ["Product defects"], "boom"),
      reportTr("broken-1", "broken", ["Test defects"]),
      reportTr("passed-1", "passed", []),
      reportTr("skipped-1", "skipped", []),
    ]);

    const [[fileName, tree]] = vi.mocked(writer.writeWidget).mock.calls as [string, any][];
    const groups = tree.groupsById as Record<string, ReportTreeGroup & { groups?: string[]; leaves?: string[] }>;
    const describeGroup = (id: string): unknown => ({
      name: groups[id].name,
      total: groups[id].statistic.total,
      groups: (groups[id].groups ?? []).map(describeGroup),
      leaves: groups[id].leaves ?? [],
    });

    expect(fileName).toBe("categories.json");
    expect(tree.root.leaves).toEqual([]);
    expect(Object.keys(tree.leavesById).sort()).toEqual(["broken-1", "failed-1", "failed-2"]);
    expect(tree.root.groups.map(describeGroup)).toEqual([
      {
        name: "Product defects",
        total: 2,
        groups: [{ name: "boom", total: 2, groups: [], leaves: ["failed-1", "failed-2"] }],
        leaves: [],
      },
      {
        name: "Test defects",
        total: 1,
        groups: [{ name: "No message", total: 1, groups: [], leaves: ["broken-1"] }],
        leaves: [],
      },
    ]);
  });
});

describe("analytics", () => {
  const payload = {
    allureVersion: "1.0.0",
    reportDataFiles: [],
    reportName: "Test report",
    reportUuid: "report-uuid",
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should include analytics by default", async () => {
    vi.stubEnv("ALLURE_NO_ANALYTICS", "");
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({ ...payload, reportFiles });

    expect(files.get("index.html")?.toString("utf8")).toContain("googletagmanager");
  });

  it("should not include analytics when ALLURE_NO_ANALYTICS is set", async () => {
    vi.stubEnv("ALLURE_NO_ANALYTICS", "true");
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({ ...payload, reportFiles });

    expect(files.get("index.html")?.toString("utf8")).not.toContain("googletagmanager");
  });
});

describe("generateTestResults history", () => {
  it("resolves history urls through the history resolver and keeps unresolved entries without url", async () => {
    const testResult = mockTestResult("tr-1", "test", "passed");
    const writer: ClassicDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const store = {
      allTestResults: vi.fn().mockResolvedValue([testResult]),
      metadataByKey: vi.fn().mockResolvedValue(undefined),
      relatedByTestResultIds: vi.fn().mockResolvedValue({
        attachmentsByTrId: new Map(),
        fixturesByTrId: new Map(),
        historyByTrId: new Map([
          [
            "tr-1",
            [
              { id: "old-1", status: "failed", url: "http://reports.example/run-1/" },
              { id: "old-2", status: "passed", url: "" },
            ],
          ],
        ]),
        retriesByTrId: new Map(),
      }),
    } as unknown as AllureStore;
    const resolveHistoryUrl = vi.fn(
      (historyUrl: string, pluginId: string, id: string) => `${historyUrl}${pluginId}/index.html#${id}`,
    );

    const [converted] = await generateTestResults(writer, store, { pluginId: "classic", resolveHistoryUrl });

    expect(converted?.history.map(({ url }) => url)).toEqual([
      "http://reports.example/run-1/classic/index.html#testresult/old-1",
      "",
    ]);
  });

  it("adds idea links when the option is enabled", async () => {
    const testResult = {
      ...mockTestResult("tr-1", "test", "passed"),
      labels: [{ name: "testClass", value: "org.example.FooTest" }],
    };
    const writer: ClassicDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const store = {
      allTestResults: vi.fn().mockResolvedValue([testResult]),
      metadataByKey: vi.fn().mockResolvedValue(undefined),
      relatedByTestResultIds: vi.fn().mockResolvedValue({
        attachmentsByTrId: new Map(),
        fixturesByTrId: new Map(),
        historyByTrId: new Map(),
        retriesByTrId: new Map(),
      }),
    } as unknown as AllureStore;

    const [converted] = await generateTestResults(writer, store, { ideaLinks: true });

    expect(converted?.links.map(({ type }) => type)).toEqual(["idea"]);
  });
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

describe("generateStaticFiles", () => {
  const payload = {
    allureVersion: "1.0.0",
    reportDataFiles: [],
    reportName: "Test report",
    reportUuid: "report-uuid",
  };

  it("should pass the link to the root overview to the report options", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({ ...payload, reportFiles, overviewHref: "../index.html" });

    expect(files.get("index.html")?.toString("utf8")).toContain('"overviewHref":"../index.html"');
  });

  it("should not add the overview link to the report options when there is no overview", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({ ...payload, reportFiles });

    expect(files.get("index.html")?.toString("utf8")).not.toContain("overviewHref");
  });

  it("should inline the favicon so it works without extra report files", async () => {
    const { files, reportFiles } = createReportFiles();

    await generateStaticFiles({ ...payload, reportFiles });

    const html = files.get("index.html")?.toString("utf8");

    expect(html).toContain('<link rel="icon" href="data:image/svg+xml,');
    expect(html).not.toContain('href="favicon.ico"');
  });
});

describe("generateTreeByCategories", () => {
  it("should include only the tests that matched a category", async () => {
    const writer = { writeWidget: vi.fn().mockResolvedValue(undefined) } as unknown as ClassicDataWriter;
    const tests = [
      { ...mockTestResult("failed", "failed test", "failed"), categories: [{ name: "Product defects" }] },
      { ...mockTestResult("passed", "passed test", "passed"), categories: [] },
      { ...mockTestResult("skipped", "skipped test", "skipped") },
      {
        ...mockTestResult("retry", "retried test", "broken"),
        isRetry: true,
        categories: [{ name: "Test defects" }],
      },
    ] as unknown as ReportTestResult[];

    await generateTreeByCategories(writer, "categories", tests);

    const [[fileName, tree]] = vi.mocked(writer.writeWidget).mock.calls;

    expect(fileName).toBe("categories.json");
    expect(Object.keys(tree.leavesById)).toEqual(["failed"]);
    expect(tree.root.leaves ?? []).toEqual([]);
    expect(tree.root.groups.map((id: string) => tree.groupsById[id].name)).toEqual(["Product defects"]);
  });
});

describe("classicChartsConfig", () => {
  it("should add the Allure 2 duration, retries and categories trends of the last 20 runs to the default charts", () => {
    expect(classicChartsConfig.slice(0, defaultChartsConfig.length)).toEqual(defaultChartsConfig);
    expect(classicChartsConfig.slice(defaultChartsConfig.length)).toEqual([
      { type: ChartType.DurationTrend, limit: 20 },
      { type: ChartType.RetriesTrend, limit: 20 },
      { type: ChartType.CategoriesTrend, limit: 20 },
    ]);
  });
});
