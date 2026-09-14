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
  it("should not create a test stage without steps or attachments", () => {
    const result = convertTestResult(
      {
        attachmentMap: new Map(),
        fixtures: [],
        categories: [],
        retries: [],
        history: [],
      },
      createTestResult({
        status: "failed",
        error: { message: "status only", trace: "status trace" },
      }),
    );

    expect(result.testStage).toBeNull();
    expect(result).toMatchObject({
      statusMessage: "status only",
      statusTrace: "status trace",
    });
  });

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

  it("should restore Allure 2 history, links, flags, and top-level attachments", () => {
    const result = convertTestResult(
      {
        attachmentMap: new Map([
          ["page-id", "page.html"],
          ["actual-id", "actual.png"],
          ["expected-id", "expected.png"],
          ["diff-id", "diff.png"],
        ]),
        fixtures: [],
        categories: [],
        retries: [createTestResult({ id: "retry", status: "passed", start: 1, stop: 2, duration: 1 })],
        history: [],
        legacyHistory: {
          statistic: { failed: 1, passed: 2, total: 3 },
          items: [
            { uid: "passed", status: "passed", time: { duration: 1 } },
            { uid: "failed", status: "failed", time: { duration: 1 } },
          ],
        },
      },
      createTestResult({
        status: "failed",
        error: { message: "stage failure", trace: "stage trace" },
        sourceMetadata: {
          readerId: "allure2",
          metadata: {
            allure2_links: [
              { name: "Report", url: "https://example.org/report", type: "custom" },
              { name: "Label without URL", type: "custom" },
            ],
            allure2_top_level_attachment_count: 3,
          },
        },
        steps: [
          {
            type: "step",
            name: "capture screenshots",
            status: "passed",
            parameters: [],
            steps: [
              {
                type: "attachment",
                link: {
                  id: "page-id",
                  name: "Page",
                  originalFileName: "page-source.html",
                  ext: ".html",
                  contentType: "text/html",
                  used: true,
                  missed: false,
                },
              },
            ],
          },
          {
            type: "attachment",
            link: {
              id: "actual-id",
              name: "actual",
              originalFileName: "actual-source.png",
              ext: ".png",
              contentType: "image/png",
              used: true,
              missed: false,
            },
          },
          {
            type: "attachment",
            link: {
              id: "expected-id",
              name: "expected",
              originalFileName: "expected-source.png",
              ext: ".png",
              contentType: "image/png",
              used: true,
              missed: false,
            },
          },
          {
            type: "attachment",
            link: {
              id: "diff-id",
              name: "diff",
              originalFileName: "diff-source.png",
              ext: ".png",
              contentType: "image/png",
              used: true,
              missed: false,
            },
          },
        ],
      }),
    );

    expect(result.links).toEqual([
      { name: "Report", url: "https://example.org/report", type: "custom" },
      { name: "Label without URL", type: "custom" },
    ]);
    expect(result.testStage.steps).toHaveLength(1);
    expect(result.testStage.steps[0]).toMatchObject({
      steps: [],
      stepsCount: 0,
      attachments: [expect.objectContaining({ name: "Page", source: "page.html" })],
      attachmentsCount: 1,
      hasContent: true,
      attachmentStep: false,
    });
    expect(result.testStage.attachments).toEqual([
      expect.objectContaining({ name: "actual", source: "actual.png" }),
      expect.objectContaining({ name: "expected", source: "expected.png" }),
      expect.objectContaining({ name: "diff", source: "diff.png" }),
    ]);
    expect(result.testStage).toMatchObject({
      statusMessage: "stage failure",
      statusTrace: "stage trace",
      stepsCount: 1,
      attachmentsCount: 4,
      shouldDisplayMessage: true,
      hasContent: true,
    });
    expect(Object.keys(result.extra.history.statistic)).toEqual([
      "failed",
      "broken",
      "skipped",
      "passed",
      "unknown",
      "total",
    ]);
    expect(result).toMatchObject({
      flaky: true,
      newFailed: true,
      retriesStatusChange: true,
      extra: {
        history: {
          statistic: { failed: 2, passed: 2, total: 4 },
        },
      },
    });
  });
});
