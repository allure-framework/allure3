import { type TestResult, fallbackTestCaseIdLabelName } from "@allurereport/core-api";
import { describe, expect, it } from "vitest";

import { convertTestResult } from "../src/converters.js";

const createTestResult = (overrides: Partial<TestResult> = {}): TestResult => {
  return {
    id: "id",
    name: "name",
    status: "passed",
    duration: 1,
    flaky: false,
    muted: false,
    known: false,
    hidden: false,
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
});
