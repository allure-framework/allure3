import { md5Utf8 } from "@allurereport/core-api";
import { attachment, epic, feature, issue, label, step, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StateData } from "../../src/store/convert.js";
import { testResultRawToState } from "../../src/store/convert.js";

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

let emptyStateData: StateData;

beforeEach(async () => {
  await epic("coverage");
  await feature("report-engine");
  await story("convert");
  await label("coverage", "report-engine");
});

describe("testResultRawToState", () => {
  beforeEach(() => {
    emptyStateData = {
      testCases: new Map(),
      attachments: new Map(),
      visitAttachmentLink: () => {},
    };
  });

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

  it("should keep dynamic tests without stable or retry identity", async () => {
    const result = await functionUnderTest(emptyStateData, {}, { readerId });
    expect(result).toMatchObject({
      testCaseHash: undefined,
      parametersHash: md5Utf8(""),
      retryHash: undefined,
    });
  });

  it("should calculate canonical identity based on testId", async () => {
    const testId = "a test id";
    const result = await functionUnderTest(emptyStateData, { testId }, { readerId });
    expect(result).toMatchObject({
      testCaseHash: md5Utf8(testId),
      parametersHash: md5Utf8(""),
      retryHash: `${md5Utf8(testId)}.${md5Utf8("")}`,
    });
  });

  it("should calculate canonical identity based on fullName", async () => {
    const fullName = "a test full name";
    const result = await functionUnderTest(emptyStateData, { fullName }, { readerId });
    expect(result).toMatchObject({
      testCaseHash: md5Utf8(fullName),
      retryHash: `${md5Utf8(fullName)}.${md5Utf8("")}`,
    });
  });

  it("should prefer testId when testId and fullName are present", async () => {
    const testId = "a test id";
    const fullName = "a test full name";
    const result = await functionUnderTest(emptyStateData, { fullName, testId }, { readerId });
    expect(result).toMatchObject({
      testCaseHash: md5Utf8(testId),
      retryHash: `${md5Utf8(testId)}.${md5Utf8("")}`,
    });
  });

  it("should normalize AS_ID without changing test identity", async () => {
    const testId = "a test id";
    const result = await functionUnderTest(
      emptyStateData,
      {
        testId,
        labels: [{ name: "AS_ID", value: "-1" }],
      },
      { readerId },
    );

    expect(result.testCase).toMatchObject({
      id: md5Utf8(testId),
      externalId: testId,
      allureId: "-1",
    });
    expect(result.testCaseHash).toBe(md5Utf8(testId));
    expect(result.labels).toContainEqual({ name: "ALLURE_ID", value: "-1" });
  });

  it("should include parameters in canonical hashes", async () => {
    const testId = "a test id";
    const parameters = [
      {
        name: "first",
        value: "second",
      },
    ];
    const result = await functionUnderTest(emptyStateData, { testId, parameters }, { readerId });
    expect(result).toMatchObject({
      parametersHash: md5Utf8("first:second"),
      retryHash: `${md5Utf8(testId)}.${md5Utf8("first:second")}`,
    });
  });

  it("should sort parameters in canonical hashes", async () => {
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
      parametersHash: md5Utf8("a:2,b:3,c:1"),
    });
  });

  it("should exclude excluded parameters from canonical hashes", async () => {
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
      parametersHash: md5Utf8("a:2,c:1"),
    });
  });

  it("should hash an empty parameters array", async () => {
    const testId = "a test id";
    const result = await functionUnderTest(emptyStateData, { testId, parameters: [] }, { readerId });
    expect(result).toMatchObject({
      parametersHash: md5Utf8(""),
    });
  });

  it("should ignore adapter-provided history and parameter hashes", async () => {
    const result = await functionUnderTest(
      emptyStateData,
      {
        testId: "test-case-id",
        historyId: "adapter-history-id",
        parametersHash: "adapter-parameters-hash",
        parameters: [{ name: "argument", value: "value" }],
      },
      { readerId },
    );

    expect(result.parametersHash).toBe("310bf7d9fc9765b03f3a78f1816f40a8");
    expect(result.retryHash).toBe("97a2c529ed683cc603ce988040c657f8.310bf7d9fc9765b03f3a78f1816f40a8");
    expect(result).not.toHaveProperty("historyId");
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

  describe("a converted step attachment", () => {
    it("should match a visited link", async () => {
      await issue("171");
      const visitAttachmentLink = vi.fn<StateData["visitAttachmentLink"]>();

      const result = await functionUnderTest(
        { ...emptyStateData, visitAttachmentLink },
        { steps: [{ type: "step", steps: [{ type: "attachment", originalFileName: "some-file.txt" }] }] },
        { readerId },
      );

      const { id } = visitAttachmentLink.mock.calls[0][0];
      expect(result.steps).toMatchObject([
        {
          type: "step",
          steps: [
            {
              type: "attachment",
              link: { id },
            },
          ],
        },
      ]);
    });
  });

  describe("a converted step", () => {
    it("should mark the message if it's contained in a sub-step", async () => {
      const result = await functionUnderTest(
        emptyStateData,
        {
          steps: [
            {
              type: "step",
              message: "Lorem Ipsum",
              trace: "foo",
              steps: [
                {
                  type: "step",
                  message: "Lorem Ipsum",
                  trace: "bar",
                  steps: [
                    {
                      type: "step",
                      message: "Lorem Ipsum",
                      trace: "baz",
                    },
                  ],
                },
              ],
            },
          ],
        },
        { readerId },
      );
      expect(result.steps).toMatchObject([
        {
          hasSimilarErrorInSubSteps: true,
          steps: [
            {
              hasSimilarErrorInSubSteps: true,
              steps: [{ hasSimilarErrorInSubSteps: false }],
            },
          ],
        },
      ]);
    });

    it("should not mark the message if it isn't contained in a sub-step", async () => {
      const result = await functionUnderTest(
        emptyStateData,
        {
          steps: [
            {
              type: "step",
              message: "Lorem Ipsum 1",
              trace: "foo",
              steps: [
                {
                  type: "step",
                  message: "Lorem Ipsum 2",
                  trace: "bar",
                  steps: [
                    {
                      type: "step",
                      message: "Lorem Ipsum 3",
                      trace: "baz",
                    },
                  ],
                },
              ],
            },
          ],
        },
        { readerId },
      );
      expect(result.steps).toMatchObject([
        {
          hasSimilarErrorInSubSteps: false,
          steps: [
            {
              hasSimilarErrorInSubSteps: false,
              steps: [{ hasSimilarErrorInSubSteps: false }],
            },
          ],
        },
      ]);
    });
  });

  describe("description fields", () => {
    it("should pass through description as-is", async () => {
      const result = await functionUnderTest(emptyStateData, { description: "plain text description" }, { readerId });
      expect(result).toMatchObject({
        description: "plain text description",
      });
    });

    it("should pass through descriptionHtml as-is when provided", async () => {
      const result = await functionUnderTest(
        emptyStateData,
        { descriptionHtml: "<p>HTML description</p>" },
        { readerId },
      );
      expect(result).toMatchObject({
        descriptionHtml: "<p>HTML description</p>",
      });
    });

    it("should not generate descriptionHtml from markdown description when descriptionHtml is not provided", async () => {
      const result = await functionUnderTest(emptyStateData, { description: "**bold** text" }, { readerId });
      expect(result).toMatchObject({
        description: "**bold** text",
        descriptionHtml: undefined,
      });
    });

    it("should preserve both description and descriptionHtml when both are provided", async () => {
      const result = await functionUnderTest(
        emptyStateData,
        { description: "plain text", descriptionHtml: "<p>custom HTML</p>" },
        { readerId },
      );
      expect(result).toMatchObject({
        description: "plain text",
        descriptionHtml: "<p>custom HTML</p>",
      });
    });

    it("should not generate descriptionHtml when description is undefined", async () => {
      const result = await functionUnderTest(emptyStateData, {}, { readerId });
      expect(result).toMatchObject({
        description: undefined,
        descriptionHtml: undefined,
      });
    });
  });
});
