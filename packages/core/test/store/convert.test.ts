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

  it("should preserve multiple test errors and expose the first one as the primary error", async () => {
    const errors = [
      { message: "first assertion", trace: "first trace", actual: "1", expected: "2" },
      { message: "second assertion", trace: "second trace" },
    ];

    const result = await functionUnderTest(emptyStateData, { errors }, { readerId });

    expect(result.error).toEqual({
      message: "first assertion",
      trace: "first trace",
      actual: "1",
      expected: "2",
    });
    expect(result.errors).toEqual([
      {
        message: "first assertion",
        trace: "first trace",
        actual: "1",
        expected: "2",
      },
      {
        message: "second assertion",
        trace: "second trace",
      },
    ]);
  });

  it("should fall back to legacy status details when errors is empty", async () => {
    const result = await functionUnderTest(
      emptyStateData,
      { message: "legacy summary", trace: "legacy trace", errors: [] },
      { readerId },
    );

    expect(result.error).toEqual({ message: "legacy summary", trace: "legacy trace" });
    expect(result.errors).toBeUndefined();
  });

  it("should prefer structured errors over legacy status details", async () => {
    const result = await functionUnderTest(
      emptyStateData,
      {
        message: "legacy summary",
        trace: "legacy trace",
        errors: [{ message: "structured assertion", trace: "structured trace" }],
      },
      { readerId },
    );

    expect(result.error).toEqual({ message: "structured assertion", trace: "structured trace" });
    expect(result.errors).toEqual([{ message: "structured assertion", trace: "structured trace" }]);
  });

  it("should ignore null entries in structured errors", async () => {
    const result = await functionUnderTest(
      emptyStateData,
      {
        errors: [null, { message: "structured assertion" }],
      } as any,
      { readerId },
    );

    expect(result.error).toEqual({ message: "structured assertion", trace: undefined });
    expect(result.errors).toEqual([{ message: "structured assertion", trace: undefined }]);
  });

  it("should keep dynamic tests without stable or retry identity", async () => {
    const result = await functionUnderTest(emptyStateData, {}, { readerId });
    expect(result).toMatchObject({
      testCaseHash: null,
      parametersHash: md5Utf8(""),
      environmentHash: null,
      retryHash: null,
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

  it.each(["ALLURE_ID", "AS_ID"])("selects the first nonempty original %s before expanding tags", async (labelName) => {
    const result = await functionUnderTest(
      emptyStateData,
      {
        testId: "test-case-id",
        parameters: [{ name: "argument", value: "value" }],
        labels: [
          { name: "tag", value: "@allure.id:from-tag" },
          { name: "ALLURE_ID", value: "  " },
          { name: "AS_ID" },
          { name: labelName, value: " 123 " },
          { name: "ALLURE_ID", value: "456" },
        ],
      },
      { readerId },
    );

    expect(result.testCase?.allureId).toBe("123");
    expect(result.testCaseHash).toBe("97a2c529ed683cc603ce988040c657f8");
    expect(result.parametersHash).toBe("310bf7d9fc9765b03f3a78f1816f40a8");
    expect(result.retryHash).toBe("97a2c529ed683cc603ce988040c657f8.310bf7d9fc9765b03f3a78f1816f40a8");
    expect(result.labels).toContainEqual({ name: "ALLURE_ID", value: "from-tag" });
  });

  it("keeps tag shorthand separate from explicit external ID selection", async () => {
    const result = await functionUnderTest(
      emptyStateData,
      { testId: "test-case-id", labels: [{ name: "tag", value: "@allure.id:from-tag" }] },
      { readerId },
    );

    expect(result.testCase?.allureId).toBeUndefined();
    expect(result.labels).toContainEqual({ name: "ALLURE_ID", value: "from-tag" });
  });

  it("keeps the first nonempty explicit Allure ID on a shared test case", async () => {
    const first = await functionUnderTest(emptyStateData, { testId: "test-case-id" }, { readerId });
    const second = await functionUnderTest(
      emptyStateData,
      { testId: "test-case-id", labels: [{ name: "AS_ID", value: "123" }] },
      { readerId },
    );
    const third = await functionUnderTest(
      emptyStateData,
      { testId: "test-case-id", labels: [{ name: "ALLURE_ID", value: "456" }] },
      { readerId },
    );

    expect(first.testCase).toBe(second.testCase);
    expect(second.testCase).toBe(third.testCase);
    expect(first.testCase?.allureId).toBe("123");
    expect(first.sourceMetadata.legacyTestCaseHash).toBe(md5Utf8("test-case-id"));
    expect(second.sourceMetadata.legacyTestCaseHash).toBe(md5Utf8("ALLURE_ID=123"));
    expect(third.sourceMetadata.legacyTestCaseHash).toBe(md5Utf8("ALLURE_ID=456"));
  });

  it.each([
    {
      name: "preserved whitespace",
      labels: [{ name: "ALLURE_ID", value: " 123 " }],
      expectedIdentity: "ALLURE_ID= 123 ",
    },
    {
      name: "blank ID before a valid ID",
      labels: [
        { name: "ALLURE_ID", value: "" },
        { name: "ALLURE_ID", value: "123" },
      ],
      expectedIdentity: "test-case-id",
    },
    {
      name: "-1 sentinel before a valid ID",
      labels: [
        { name: "ALLURE_ID", value: "-1" },
        { name: "AS_ID", value: "123" },
      ],
      expectedIdentity: "ALLURE_ID=123",
    },
  ])("preserves the legacy raw-label selection for $name", async ({ labels, expectedIdentity }) => {
    const result = await functionUnderTest(
      emptyStateData,
      {
        testId: "test-case-id",
        labels,
      },
      { readerId },
    );

    expect(result.sourceMetadata.legacyTestCaseHash).toBe(md5Utf8(expectedIdentity));
  });

  it("preserves per-result legacy identity when canonical test cases are interned from different fields", async () => {
    const first = await functionUnderTest(emptyStateData, { fullName: "shared-identity" }, { readerId });
    const second = await functionUnderTest(
      emptyStateData,
      { testId: "shared-identity", fullName: "different-full-name" },
      { readerId },
    );

    expect(first.testCase).toBe(second.testCase);
    expect(first.sourceMetadata.legacyTestCaseHash).toBe(md5Utf8("shared-identity"));
    expect(second.sourceMetadata.legacyTestCaseHash).toBe(md5Utf8("shared-identity"));
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

  it("rejects missing, empty, and non-string parameter names without changing accepted values or flags", async () => {
    const result = await functionUnderTest(
      emptyStateData,
      {
        parameters: [
          { name: null, value: "null name" },
          { name: "", value: "empty name" },
          { name: 1 as unknown as string, value: "numeric name" },
          { name: "kept", value: null, hidden: true, masked: true, excluded: true },
        ],
      },
      { readerId },
    );

    expect(result.parameters).toEqual([
      { name: "kept", value: "#___unknown_value___#", hidden: true, masked: true, excluded: true },
    ]);
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
    expect(result.sourceMetadata.legacyHistoryId).toBe("adapter-history-id");
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

  describe("known failures", () => {
    it("should set known true and not set resolution from known; store classifies later", async () => {
      const result = await functionUnderTest(
        emptyStateData,
        { status: "failed", known: true, muted: true, flaky: true },
        { readerId },
      );
      expect(result).toMatchObject({
        known: true,
        muted: true,
        flaky: true,
      });
      expect(result.resolution).toBeUndefined();
      expect(result.resolutionComment).toBeUndefined();
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
