import type { AttachmentTestStepResult, DefaultTestStepResult } from "@allurereport/core-api";
import type { AwesomeTestResult } from "types";
import { describe, expect, it } from "vitest";

import { getBodyItems, getTestLevelErrorId } from "@/components/TestResult/bodyItems";

const sampleStep: DefaultTestStepResult = {
  type: "step",
  stepId: "body-step-id",
  name: "body step",
  status: "passed",
  parameters: [],
  steps: [],
};

const sampleAttachment: AttachmentTestStepResult = {
  type: "attachment",
  link: {
    id: "attachment-id",
    ext: ".txt",
    name: "assertion",
    used: true,
    missed: false,
    contentType: "text/plain",
    originalFileName: "assertion.txt",
    contentLength: 47,
  },
};

const makeTestResult = (
  overrides: Partial<Pick<AwesomeTestResult, "id" | "status" | "steps" | "error">> = {},
): Pick<AwesomeTestResult, "id" | "status" | "steps" | "error"> => ({
  id: "test-result-id",
  status: "failed",
  steps: [sampleStep],
  error: undefined,
  ...overrides,
});

describe("components > TestResult > bodyItems", () => {
  it("should append a test-level error item for failed tests", () => {
    const bodyItems = getBodyItems(
      makeTestResult({ error: { message: "\u001B[31m  boom  \nsecond line\u001B[39m" } }),
      "Error",
    );

    expect(bodyItems).toEqual([
      {
        type: "step",
        item: sampleStep,
        bodyItems: [],
        suppressInlineError: false,
      },
      {
        type: "error",
        id: getTestLevelErrorId("test-result-id"),
        title: "boom",
        status: "failed",
        error: { message: "\u001B[31m  boom  \nsecond line\u001B[39m" },
      },
    ]);
  });

  it("should nest the synthetic error into the deepest matching broken step", () => {
    const step3: DefaultTestStepResult = {
      type: "step",
      stepId: "step-3-id",
      name: "step 3",
      status: "broken",
      parameters: [],
      steps: [],
      message: "step 3 error",
      trace: "step 3 trace",
    };
    const step2: DefaultTestStepResult = {
      type: "step",
      stepId: "step-2-id",
      name: "step 2",
      status: "broken",
      parameters: [],
      steps: [step3],
      message: "step 3 error",
      trace: "step 3 trace",
      hasSimilarErrorInSubSteps: true,
    };
    const step1: DefaultTestStepResult = {
      type: "step",
      stepId: "step-1-id",
      name: "step 1",
      status: "broken",
      parameters: [],
      steps: [step2],
      message: "step 3 error",
      trace: "step 3 trace",
      hasSimilarErrorInSubSteps: true,
    };

    const bodyItems = getBodyItems(
      makeTestResult({
        status: "broken",
        steps: [step1],
        error: { message: "step 3 error", trace: "step 3 trace" },
      }),
      "Error",
    );

    expect(bodyItems).toEqual([
      {
        type: "step",
        item: step1,
        bodyItems: [
          {
            type: "step",
            item: step2,
            bodyItems: [
              {
                type: "step",
                item: step3,
                bodyItems: [
                  {
                    type: "error",
                    id: getTestLevelErrorId("test-result-id"),
                    title: "step 3 error",
                    status: "broken",
                    error: { message: "step 3 error", trace: "step 3 trace" },
                  },
                ],
                suppressInlineError: true,
              },
            ],
            suppressInlineError: false,
          },
        ],
        suppressInlineError: false,
      },
    ]);
  });

  it("shouldn't append a test-level error item when the error has no displayable content", () => {
    expect(getBodyItems(makeTestResult({ error: {} }), "Error")).toEqual([
      {
        type: "step",
        item: sampleStep,
        bodyItems: [],
        suppressInlineError: false,
      },
    ]);
    expect(getBodyItems(makeTestResult({ error: { actual: "undefined", expected: "expected" } }), "Error")).toEqual([
      {
        type: "step",
        item: sampleStep,
        bodyItems: [],
        suppressInlineError: false,
      },
    ]);
    expect(
      getBodyItems(makeTestResult({ status: "passed", error: { message: "should not appear" } }), "Error"),
    ).toEqual([
      {
        type: "step",
        item: sampleStep,
        bodyItems: [],
        suppressInlineError: false,
      },
    ]);
  });

  it("should keep the synthetic error item last at top level when no nested step matches", () => {
    const bodyItems = getBodyItems(
      makeTestResult({
        steps: [sampleStep, sampleAttachment],
        error: { message: "boom" },
      }),
      "Error",
    );

    expect(bodyItems).toEqual([
      {
        type: "step",
        item: sampleStep,
        bodyItems: [],
        suppressInlineError: false,
      },
      sampleAttachment,
      {
        type: "error",
        id: getTestLevelErrorId("test-result-id"),
        title: "boom",
        status: "failed",
        error: { message: "boom" },
      },
    ]);
  });
});
