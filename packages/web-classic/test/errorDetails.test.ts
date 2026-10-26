import type { DefaultTestStepResult, TestStepResult } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  countFailedSubSteps,
  getStepError,
  hasFailedFixture,
  shouldShowStepError,
} from "../src/components/TestResult/TestResultError/errorDetails.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("test-result-errors");
  await label("coverage", "test-result-errors");
});

const step = (overrides: Partial<DefaultTestStepResult> = {}): DefaultTestStepResult => ({
  type: "step",
  name: "step",
  status: "passed",
  parameters: [],
  steps: [],
  ...overrides,
});

const attachment: TestStepResult = {
  type: "attachment",
  link: { id: "a", name: "a", originalFileName: "a.txt", ext: ".txt", used: true, missed: true },
};

describe("step errors", () => {
  beforeEach(async () => {
    await story("step and fixture errors");
  });

  it("reads step message and trace, and falls back to the fixture error", () => {
    expect(getStepError(step({ message: "m", trace: "t" }))).toEqual({
      message: "m",
      trace: "t",
      actual: undefined,
      expected: undefined,
    });
    expect(
      getStepError({ status: "broken", error: { message: "fm", trace: "ft", expected: "e", actual: "a" }, steps: [] }),
    ).toEqual({ message: "fm", trace: "ft", expected: "e", actual: "a" });
  });

  it("shows a step error unless the store marked it as repeated in substeps", () => {
    expect(shouldShowStepError(step({ status: "failed", message: "boom" }))).toBe(true);
    expect(shouldShowStepError(step({ status: "failed", message: "boom", hasSimilarErrorInSubSteps: true }))).toBe(
      false,
    );
    expect(shouldShowStepError(step({ status: "passed" }))).toBe(false);
  });

  it("trusts the store flag over the nested messages", () => {
    const nested = step({ status: "failed", message: "boom" });

    expect(
      shouldShowStepError(
        step({ status: "failed", message: "boom", hasSimilarErrorInSubSteps: false, steps: [nested] }),
      ),
    ).toBe(true);
  });

  it("hides a fixture error that a nested step already shows, ignoring ANSI codes and spacing", () => {
    const nested = step({
      status: "broken",
      steps: [attachment, step({ status: "broken", message: "\u001b[31mconnection refused\u001b[39m\n" })],
    });

    expect(shouldShowStepError({ status: "broken", error: { message: "connection refused" }, steps: [nested] })).toBe(
      false,
    );
    expect(shouldShowStepError({ status: "broken", error: { message: "timeout" }, steps: [nested] })).toBe(true);
    expect(shouldShowStepError({ status: "broken", error: { trace: "at setup" }, steps: [nested] })).toBe(true);
  });
});

describe("step counters", () => {
  beforeEach(async () => {
    await story("failed substeps");
  });

  it("counts failed and broken steps in the whole subtree and skips attachments and other statuses", () => {
    const steps = [
      step({ status: "failed", steps: [step({ status: "failed" }), step({ status: "broken" }), attachment] }),
      step({ status: "skipped" }),
      step({ status: "passed", steps: [step({ status: "broken" })] }),
      attachment,
    ];

    expect(countFailedSubSteps(steps)).toEqual({ failed: 2, broken: 2 });
    expect(countFailedSubSteps(undefined)).toEqual({});
  });

  it("detects failed fixtures", () => {
    expect(hasFailedFixture([{ status: "passed" }, { status: "broken" }])).toBe(true);
    expect(hasFailedFixture([{ status: "passed" }, { status: "skipped" }])).toBe(false);
    expect(hasFailedFixture(undefined)).toBe(false);
  });
});
