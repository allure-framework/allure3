import type { AttachmentLink, TestFixtureResult, TestResult } from "@allurereport/core-api";
import type { AllureStore, ResultFile } from "@allurereport/plugin-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateAttachmentsFiles, generateTestResults } from "../src/generators.js";
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

describe("generateAttachmentsFiles", () => {
  it("should skip missed attachments and keep writing later available attachments", async () => {
    const writtenContent = { kind: "attachment" } as ResultFile;
    const writer: ClassicDataWriter = {
      writeData: vi.fn().mockResolvedValue(undefined),
      writeWidget: vi.fn().mockResolvedValue(undefined),
      writeTestCase: vi.fn().mockResolvedValue(undefined),
      writeAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const attachmentLinks: AttachmentLink[] = [
      {
        id: "missed",
        ext: ".txt",
        originalFileName: "missed.txt",
        name: "missed",
        missed: true,
        used: true,
      },
      {
        id: "written",
        ext: ".txt",
        originalFileName: "written.txt",
        name: "written",
        missed: false,
        used: true,
      },
    ];

    const result = await generateAttachmentsFiles(
      writer,
      attachmentLinks,
      vi.fn(async (id: string) => (id === "written" ? writtenContent : undefined)),
    );

    expect(writer.writeAttachment).toHaveBeenCalledTimes(1);
    expect(writer.writeAttachment).toHaveBeenCalledWith("written.txt", writtenContent);
    expect(result).toEqual(new Map([["written", "written.txt"]]));
  });
});
