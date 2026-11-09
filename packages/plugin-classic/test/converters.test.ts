import type { TestResult } from "@allurereport/core-api";
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
    known: false,
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
  it("does not expose retry identity under the legacy historyId name", () => {
    const result = convertTestResult(createTestResult({ retryHash: "retry-hash" }));

    expect(result).not.toHaveProperty("historyId");
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

describe("convertTestResult preconditions and expected results", () => {
  it("converts markdown precondition and expected result to html", () => {
    const result = convertTestResult(
      createTestResult({ precondition: "user is **logged in**", expectedResult: "page is *shown*" }),
    );

    expect(result.preconditionHtml).toBe("<p>user is <strong>logged in</strong></p>\n");
    expect(result.expectedResultHtml).toBe("<p>page is <em>shown</em></p>\n");
  });

  it("keeps provided precondition and expected result html as-is", () => {
    const result = convertTestResult(
      createTestResult({
        precondition: "markdown",
        preconditionHtml: "<p>precondition</p>",
        expectedResult: "markdown",
        expectedResultHtml: "<p>expected</p>",
      }),
    );

    expect(result.preconditionHtml).toBe("<p>precondition</p>");
    expect(result.expectedResultHtml).toBe("<p>expected</p>");
  });

  it("leaves precondition and expected result empty when they are missing", () => {
    const result = convertTestResult(createTestResult());

    expect(result.preconditionHtml).toBeUndefined();
    expect(result.expectedResultHtml).toBeUndefined();
  });
});

describe("convertTestResult ideaLinks", () => {
  const labels = [{ name: "testClass", value: "org.example.FooTest" }];

  it("does not add idea link by default", () => {
    expect(convertTestResult(createTestResult({ labels })).links).toEqual([]);
  });

  it("adds idea link built from testClass label", () => {
    const { links } = convertTestResult(createTestResult({ labels }), { ideaLinks: true });

    expect(links).toEqual([
      {
        name: "Open in IDEA",
        type: "idea",
        url: "http://localhost:63342/api/file?file=org%2Fexample%2FFooTest.java",
      },
    ]);
  });

  it("respects custom options and keeps existing links first", () => {
    const existing = { url: "https://example.org" };
    const { links } = convertTestResult(createTestResult({ labels, links: [existing] }), {
      ideaLinks: { port: 1234, fileExtension: ".kt", sourceRoot: "/src/test/kotlin/" },
    });

    expect(links).toHaveLength(2);
    expect(links[0]).toBe(existing);
    expect(links[1].url).toBe("http://localhost:1234/api/file?file=src%2Ftest%2Fkotlin%2Forg%2Fexample%2FFooTest.kt");
  });

  it("points nested classes to the outer class file", () => {
    const { links } = convertTestResult(
      createTestResult({ labels: [{ name: "testClass", value: "org.example.FooTest$Inner" }] }),
      { ideaLinks: true },
    );

    expect(links[0].url).toBe("http://localhost:63342/api/file?file=org%2Fexample%2FFooTest.java");
  });

  it.each(["Login suite", "tests/login.spec.ts", "", "org..FooTest", "1abc.Foo", "$Foo"])(
    "skips idea link for non-class testClass %j",
    (value) => {
      expect(
        convertTestResult(createTestResult({ labels: [{ name: "testClass", value }] }), { ideaLinks: true }).links,
      ).toEqual([]);
    },
  );
});
