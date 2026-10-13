import { type TestResult, fallbackTestCaseIdLabelName } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { convertTestResult } from "../src/converters.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("report-output");
  await story("converters");
  await label("coverage", "report-output");
});

const createTestResult = (overrides: Partial<TestResult> = {}): TestResult => {
  return {
    id: "id",
    name: "name",
    status: "passed",
    duration: 1,
    flaky: false,
    muted: false,
    parametersHash: "parameters-hash",
    isRetry: false,
    labels: [],
    parameters: [],
    links: [],
    steps: [],
    error: {},
    sourceMetadata: {
      readerId: "test",
      metadata: {},
    },
    titlePath: [],
    ...overrides,
  } as TestResult;
};

describe("convertTestResult", () => {
  it("keeps identifiers used by test result copy actions", () => {
    const result = convertTestResult(
      createTestResult({
        retryHash: "retry-hash",
        testCase: { id: "test-case-id", name: "name" },
      }),
    );

    expect(result.testCase?.id).toBe("test-case-id");
    expect(result.retryHash).toBe("retry-hash");
    expect(result).not.toHaveProperty("historyId");
  });

  it("keeps multiple test errors on convert", () => {
    const result = convertTestResult(
      createTestResult({
        error: { message: "first assertion" },
        errors: [{ message: "first assertion" }, { message: "second assertion" }],
      }),
    );

    expect(result.error).toEqual({ message: "first assertion" });
    expect(result.errors).toEqual([{ message: "first assertion" }, { message: "second assertion" }]);
  });

  it("keeps known resolution fields on convert", () => {
    const result = convertTestResult(
      createTestResult({
        status: "failed",
        known: true,
        muted: false,
        resolution: "accepted",
        resolutionComment: "Accepted from result (known)",
      }),
    );

    expect(result).toMatchObject({
      known: true,
      muted: false,
      resolution: "accepted",
      resolutionComment: "Accepted from result (known)",
    });
  });

  it("derives muted resolution lifecycle from due date", () => {
    const result = convertTestResult(
      createTestResult({
        status: "failed",
        resolution: "muted",
        resolutionComment: "Waiting for upstream fix",
        resolutionDueDate: "2026-10-01T00:00:00Z",
      }),
      { resolutionEvaluatedAt: Date.parse("2026-10-01T00:00:00Z") },
    );

    expect(result).toMatchObject({
      resolution: "muted",
      resolutionComment: "Waiting for upstream fix",
      resolutionDueDate: "2026-10-01T00:00:00Z",
      resolutionState: "outdated",
    });
  });

  it("converts markdown description to html when descriptionHtml is missing", () => {
    const result = convertTestResult(createTestResult({ description: "**bold** text" }));

    expect(result.descriptionHtml).toBe("<p><strong>bold</strong> text</p>\n");
  });

  it("keeps provided descriptionHtml as-is", () => {
    const result = convertTestResult(
      createTestResult({
        description: "**bold** text",
        descriptionHtml: "<p>custom html</p>",
      }),
    );

    expect(result.descriptionHtml).toBe("<p>custom html</p>");
  });

  it("groups labels safely when label names are prototype-like", () => {
    const result = convertTestResult(
      createTestResult({
        labels: [
          { name: "__proto__", value: "proto-value" },
          { name: "constructor", value: "constructor-value" },
          { name: "toString", value: "to-string-value" },
        ],
      }),
    );

    expect(Object.getPrototypeOf(result.groupedLabels)).toBeNull();
    expect(result.groupedLabels.__proto__).toBeUndefined();
    expect(result.groupedLabels.constructor).toEqual(["constructor-value"]);
    expect(result.groupedLabels.toString).toEqual(["to-string-value"]);
  });

  it("should hide labels by exact string matcher", () => {
    const result = convertTestResult(
      createTestResult({
        labels: [
          { name: "owner", value: "qa" },
          { name: "tag", value: "ui" },
        ],
      }),
      { hideLabels: ["owner"] },
    );

    expect(result.labels).toEqual([{ name: "tag", value: "ui" }]);
    expect(result.groupedLabels.owner).toBeUndefined();
    expect(result.groupedLabels.tag).toEqual(["ui"]);
  });

  it("should hide labels by regexp matcher", () => {
    const result = convertTestResult(
      createTestResult({
        labels: [
          { name: "owner", value: "qa" },
          { name: "package", value: "suite.api" },
        ],
      }),
      { hideLabels: [/^pack/] },
    );

    expect(result.labels).toEqual([{ name: "owner", value: "qa" }]);
    expect(result.groupedLabels.package).toBeUndefined();
    expect(result.groupedLabels.owner).toEqual(["qa"]);
  });

  it("should handle stateful regexp matchers deterministically", () => {
    const matcher = /^owner$/g;
    const first = convertTestResult(
      createTestResult({
        labels: [
          { name: "owner", value: "qa-1" },
          { name: "tag", value: "ui" },
        ],
      }),
      { hideLabels: [matcher] },
    );
    const second = convertTestResult(
      createTestResult({
        labels: [
          { name: "owner", value: "qa-2" },
          { name: "tag", value: "api" },
        ],
      }),
      { hideLabels: [matcher] },
    );

    expect(first.groupedLabels.owner).toBeUndefined();
    expect(first.groupedLabels.tag).toEqual(["ui"]);
    expect(second.groupedLabels.owner).toBeUndefined();
    expect(second.groupedLabels.tag).toEqual(["api"]);
  });

  it("should hide fallback testCaseId label by default", () => {
    const result = convertTestResult(
      createTestResult({
        labels: [
          { name: fallbackTestCaseIdLabelName, value: "legacy-id" },
          { name: "owner", value: "qa" },
        ],
      }),
    );

    expect(result.labels).toEqual([{ name: "owner", value: "qa" }]);
    expect(result.groupedLabels[fallbackTestCaseIdLabelName]).toBeUndefined();
  });

  it("should hide underscore-prefixed labels by default", () => {
    const result = convertTestResult(
      createTestResult({
        labels: [
          { name: "_internal", value: "secret" },
          { name: "tag", value: "api" },
        ],
      }),
    );

    expect(result.labels).toEqual([{ name: "tag", value: "api" }]);
    expect(result.groupedLabels._internal).toBeUndefined();
    expect(result.groupedLabels.tag).toEqual(["api"]);
  });

  it("redacts result and nested body parameters without leaking secrets to JSON", () => {
    const token = { name: "token", value: "secret-token", hidden: false, masked: true, excluded: false };
    const hidden = { ...token, name: "internal", value: "hidden-value", hidden: true };
    const visible = { ...token, name: "visible", value: "value", masked: false };
    const result = convertTestResult(
      createTestResult({
        parameters: [visible, token, hidden],
        steps: [
          {
            type: "step",
            name: "step",
            status: "passed",
            parameters: [
              { ...token, value: "step-secret" },
              { ...hidden, value: "step-hidden" },
            ],
            steps: [
              {
                type: "step",
                name: "nested step",
                status: "passed",
                parameters: [
                  { ...token, value: "nested-secret" },
                  { ...hidden, value: "nested-hidden" },
                ],
                steps: [],
              },
            ],
          },
        ],
      }),
    );

    expect(result.parameters).toEqual([visible, { ...token, value: "<masked>" }]);
    expect(result.steps).toEqual([
      {
        type: "step",
        name: "step",
        status: "passed",
        parameters: [{ ...token, value: "<masked>" }],
        steps: [
          {
            type: "step",
            name: "nested step",
            status: "passed",
            parameters: [{ ...token, value: "<masked>" }],
            steps: [],
          },
        ],
      },
    ]);
    const serialized = JSON.stringify(result);
    for (const value of [
      "secret-token",
      "hidden-value",
      "step-secret",
      "step-hidden",
      "nested-secret",
      "nested-hidden",
    ]) {
      expect(serialized).not.toContain(value);
    }
  });
});
