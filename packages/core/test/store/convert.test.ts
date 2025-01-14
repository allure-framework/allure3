import { md5 } from "@allurereport/plugin-api";
import { attachment, step } from "allure-js-commons";
import { describe, expect, it } from "vitest";
import type { StateData } from "../../src/store/convert.js";
import { testResultRawToState } from "../../src/store/convert.js";

const emptyStateData: StateData = { testCases: new Map(), attachments: new Map(), visitAttachmentLink: () => {} };

const readerId = "convert.test.ts";

const wrap = <T extends (...args: any) => any, P extends Parameters<T>, R extends ReturnType<T>>(
  f: T,
): ((...args: P) => Promise<R>) => {
  return async (...args: P): Promise<R> => {
    return await step(f.name, async (): Promise<R> => {
      for (let i = 0; i < args.length; i++) {
        await attachment(`arg${i}`, JSON.stringify(args[i], null, 2), "application/json");
      }
      const result: R = f(...args);
      await attachment("result", JSON.stringify(result, null, 2), "application/json");
      return result;
    });
  };
};

const functionUnderTest = wrap(testResultRawToState).bind(this);

describe("testResultRawToState", () => {
  it("should set default name", async () => {
    const result = await functionUnderTest(emptyStateData, {}, { readerId });
    expect(result).toMatchObject({
      name: "Unknown test",
    });
  });

  it("should set default status", async () => {
    const result = await functionUnderTest(emptyStateData, {}, { readerId });
    expect(result).toMatchObject({
      status: "unknown",
    });
  });

  it("should set undefined history id for tests without testId or fullName", async () => {
    const result = await functionUnderTest(emptyStateData, {}, { readerId });
    expect(result).toMatchObject({
      historyId: undefined,
    });
  });

  it("should calculate historyId based on testId", async () => {
    const testId = "a test id";
    const result = await functionUnderTest(emptyStateData, { testId }, { readerId });
    expect(result).toMatchObject({
      historyId: `${md5(testId)}.${md5("")}`,
    });
  });

  it("should calculate historyId based on fullName", async () => {
    const fullName = "a test full name";
    const result = await functionUnderTest(emptyStateData, { fullName }, { readerId });
    expect(result).toMatchObject({
      historyId: `${md5(fullName)}.${md5("")}`,
    });
  });

  it("should calculate historyId based on testId if both testId and fullName is present", async () => {
    const testId = "a test id";
    const fullName = "a test full name";
    const result = await functionUnderTest(emptyStateData, { fullName, testId }, { readerId });
    expect(result).toMatchObject({
      historyId: `${md5(testId)}.${md5("")}`,
    });
  });

  it("should include parameters in history id", async () => {
    const testId = "a test id";
    const parameters = [
      {
        name: "first",
        value: "second",
      },
    ];
    const result = await functionUnderTest(emptyStateData, { testId, parameters }, { readerId });
    expect(result).toMatchObject({
      historyId: `${md5(testId)}.${md5("first:second")}`,
    });
  });

  it("should sort parameters in history id", async () => {
    const testId = "a test id";
    const parameters = [
      {
        name: "c",
        value: "1",
      },
      {
        name: "a",
        value: "2",
      },
      {
        name: "b",
        value: "3",
      },
    ];
    const result = await functionUnderTest(emptyStateData, { testId, parameters }, { readerId });
    expect(result).toMatchObject({
      historyId: `${md5(testId)}.${md5("a:2,b:3,c:1")}`,
    });
  });

  it("should exclude excluded parameters from history id", async () => {
    const testId = "a test id";
    const parameters = [
      {
        name: "c",
        value: "1",
      },
      {
        name: "a",
        value: "2",
      },
      {
        name: "b",
        value: "3",
        excluded: true,
      },
    ];
    const result = await functionUnderTest(emptyStateData, { testId, parameters }, { readerId });
    expect(result).toMatchObject({
      historyId: `${md5(testId)}.${md5("a:2,c:1")}`,
    });
  });

  it("should omit empty parameters array from history id calculation", async () => {
    const testId = "a test id";
    const result = await functionUnderTest(emptyStateData, { testId, parameters: [] }, { readerId });
    expect(result).toMatchObject({
      historyId: `${md5(testId)}.${md5("")}`,
    });
  });

  it("should detect attachment link content type based on file extension if specified", async () => {
    const result = await functionUnderTest(
      emptyStateData,
      { steps: [{ type: "attachment", originalFileName: "some-file.txt" }] },
      { readerId },
    );

    const [attach] = result.steps;
    expect(attach).toMatchObject({
      type: "attachment",
      link: {
        originalFileName: "some-file.txt",
        contentType: "text/plain",
      },
    });
  });

  it("should set extension based on file name", async () => {
    const result = await functionUnderTest(
      emptyStateData,
      { steps: [{ type: "attachment", originalFileName: "some-file.txt" }] },
      { readerId },
    );

    const [attach] = result.steps;
    expect(attach).toMatchObject({
      type: "attachment",
      link: {
        originalFileName: "some-file.txt",
        ext: ".txt",
      },
    });
  });
});
