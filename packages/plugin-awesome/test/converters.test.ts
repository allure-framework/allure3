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
  describe.each(["precondition", "expectedResult"] as const)("%s", (field) => {
    const htmlField = `${field}Html` as const;

    it("renders markdown and omits the source text from the report", () => {
      const result = convertTestResult(createTestResult({ [field]: "**bold** text" }));

      expect(result[htmlField]).toBe("<p><strong>bold</strong> text</p>\n");
      expect(result).not.toHaveProperty(field);
    });

    it("prefers supplied HTML to markdown", () => {
      const result = convertTestResult(createTestResult({ [field]: "**markdown**", [htmlField]: "<p>HTML</p>" }));

      expect(result[htmlField]).toBe("<p>HTML</p>");
    });

    it("preserves explicitly empty HTML instead of falling back to markdown", () => {
      const result = convertTestResult(createTestResult({ [field]: "markdown", [htmlField]: "" }));

      expect(result[htmlField]).toBe("");
    });

    it.each([undefined, ""])("does not render absent or empty text (%s)", (value) => {
      const result = convertTestResult(createTestResult({ [field]: value }));

      expect(result[htmlField]).toBeUndefined();
    });
  });

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

  it("derives muted resolution lifecycle from expiration timestamp", () => {
    const result = convertTestResult(
      createTestResult({
        status: "failed",
        resolution: "muted",
        resolutionComment: "Waiting for upstream fix",
        resolutionExpiresAt: "2026-10-01T00:00:00Z",
      }),
      { resolutionEvaluatedAt: Date.parse("2026-10-01T00:00:00Z") },
    );

    expect(result).toMatchObject({
      resolution: "muted",
      resolutionComment: "Waiting for upstream fix",
      resolutionExpiresAt: "2026-10-01T00:00:00Z",
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

describe("convertTestResult ideaLinks", () => {
  const labels = [{ name: "testClass", value: "org.example.FooTest" }];

  it("should not add idea link by default", () => {
    expect(convertTestResult(createTestResult({ labels })).links).toEqual([]);
  });

  it("should add idea link built from testClass label", () => {
    const { links } = convertTestResult(createTestResult({ labels }), { ideaLinks: {} });

    expect(links).toEqual([
      {
        name: "Open in IDEA",
        type: "idea",
        url: "http://localhost:63342/api/file?file=org%2Fexample%2FFooTest.java",
      },
    ]);
  });

  it("should respect custom port and extension and keep existing links", () => {
    const existing = { url: "https://example.org" };
    const { links } = convertTestResult(createTestResult({ labels, links: [existing] }), {
      ideaLinks: { port: 1234, fileExtension: "kt" },
    });

    expect(links).toHaveLength(2);
    expect(links[0]).toBe(existing);
    expect(links[1].url).toBe("http://localhost:1234/api/file?file=org%2Fexample%2FFooTest.kt");
  });

  it("should skip idea link without testClass label", () => {
    expect(convertTestResult(createTestResult(), { ideaLinks: {} }).links).toEqual([]);
  });

  it("should accept true as default options", () => {
    expect(convertTestResult(createTestResult({ labels }), { ideaLinks: true }).links[0].url).toBe(
      "http://localhost:63342/api/file?file=org%2Fexample%2FFooTest.java",
    );
  });

  it("should point nested classes to the outer class file and accept a dotted extension", () => {
    const { links } = convertTestResult(
      createTestResult({ labels: [{ name: "testClass", value: "org.example.FooTest$Inner" }] }),
      { ideaLinks: { fileExtension: ".kt" } },
    );

    expect(links[0].url).toBe("http://localhost:63342/api/file?file=org%2Fexample%2FFooTest.kt");
  });

  it("should not add idea link when ideaLinks is false", () => {
    expect(convertTestResult(createTestResult({ labels }), { ideaLinks: false }).links).toEqual([]);
  });

  it("should prepend sourceRoot to the file path", () => {
    const { links } = convertTestResult(createTestResult({ labels }), {
      ideaLinks: { sourceRoot: "/module/src/test/java/" },
    });

    expect(links[0].url).toBe(
      "http://localhost:63342/api/file?file=module%2Fsrc%2Ftest%2Fjava%2Forg%2Fexample%2FFooTest.java",
    );
  });

  it.each(["Login suite", "tests/login.spec.ts", "", "org..FooTest", "1abc.Foo", "$Foo"])(
    "should skip idea link for non-class testClass %j",
    (value) => {
      expect(
        convertTestResult(createTestResult({ labels: [{ name: "testClass", value }] }), { ideaLinks: true }).links,
      ).toEqual([]);
    },
  );
});
