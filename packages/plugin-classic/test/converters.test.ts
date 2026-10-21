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
