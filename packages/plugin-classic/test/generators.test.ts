import type { TestFixtureResult, TestResult } from "@allurereport/core-api";
import type { AllureStore, ReportFiles } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { generateStaticFiles, generateTestResults } from "../src/generators.js";
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
    testCaseHash: null,
    parametersHash: "",
    environmentHash: null,
    retryHash: null,
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
});
