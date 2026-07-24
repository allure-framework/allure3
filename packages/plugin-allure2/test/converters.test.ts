import type { TestResult } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { convertTestResult } from "../src/converters.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-allure2");
  await story("converters");
  await label("coverage", "plugin-allure2");
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
    quarantine: false,
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
  it("should redact hidden and masked parameters", () => {
    const result = convertTestResult(
      {
        attachmentMap: new Map(),
        fixtures: [],
        categories: [],
        retries: [],
        history: [],
      },
      createTestResult({
        parameters: [
          { name: "visible", value: "value", hidden: false, masked: false, excluded: false },
          { name: "token", value: "secret-token", hidden: false, masked: true, excluded: false },
          { name: "internal", value: "hidden-value", hidden: true, masked: false, excluded: false },
        ],
        steps: [
          {
            type: "step",
            name: "step",
            status: "passed",
            parameters: [
              { name: "step-token", value: "step-secret", hidden: false, masked: true, excluded: false },
              { name: "step-internal", value: "step-hidden", hidden: true, masked: false, excluded: false },
            ],
            steps: [
              {
                type: "step",
                name: "nested step",
                status: "passed",
                parameters: [
                  { name: "nested-token", value: "nested-secret", hidden: false, masked: true, excluded: false },
                  { name: "nested-internal", value: "nested-hidden", hidden: true, masked: false, excluded: false },
                ],
                steps: [],
              },
            ],
          },
        ],
      }),
    );

    expect(result.parameters).toEqual([
      { name: "visible", value: "value", hidden: false, masked: false, excluded: false },
      { name: "token", value: "<masked>", hidden: false, masked: true, excluded: false },
    ]);
    expect(result.testStage.steps[0].parameters).toEqual([
      { name: "step-token", value: "<masked>", hidden: false, masked: true, excluded: false },
    ]);
    expect(result.testStage.steps[0].steps[0].parameters).toEqual([
      { name: "nested-token", value: "<masked>", hidden: false, masked: true, excluded: false },
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("hidden-value");
    expect(serialized).not.toContain("step-secret");
    expect(serialized).not.toContain("step-hidden");
    expect(serialized).not.toContain("nested-secret");
    expect(serialized).not.toContain("nested-hidden");
  });
});
