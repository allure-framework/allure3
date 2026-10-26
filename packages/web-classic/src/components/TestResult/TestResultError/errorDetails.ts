import type { TestError, TestStatus, TestStepResult } from "@allurereport/core-api";

type TestErrorLike = Pick<TestError, "message" | "trace" | "actual" | "expected">;

/**
 * Anything rendered as a step row: a regular step or a setup/teardown fixture.
 * Steps carry `message`/`trace`, fixtures carry `error`.
 */
export type StepWithError = {
  status?: TestStatus;
  message?: string;
  trace?: string;
  error?: TestError;
  hasSimilarErrorInSubSteps?: boolean;
  steps?: TestStepResult[];
};

// Same pattern as @allurereport/web-commons stripAnsi, kept inline so the helper stays dependency free.
// eslint-disable-next-line no-control-regex
const ansiRegex = /\x1B\[[0-9;?]*[ -/]*[@-~]/g;

const normalizeErrorText = (value?: string) => (typeof value === "string" ? value.replace(ansiRegex, "").trim() : "");

export const hasErrorDiff = (error?: TestErrorLike) =>
  Boolean(error?.actual) && error.actual !== "undefined" && Boolean(error?.expected) && error.expected !== "undefined";

export const isDisplayableTestError = (error?: TestErrorLike) =>
  Boolean(normalizeErrorText(error?.message)) || Boolean(normalizeErrorText(error?.trace)) || hasErrorDiff(error);

export const getStepError = (step: StepWithError): TestError => ({
  message: step.message ?? step.error?.message,
  trace: step.trace ?? step.error?.trace,
  actual: step.error?.actual,
  expected: step.error?.expected,
});

const collectSubStepMessages = (steps: TestStepResult[] | undefined, messages: Set<string>) => {
  for (const subStep of steps ?? []) {
    if (subStep.type !== "step") {
      continue;
    }
    const message = normalizeErrorText(subStep.message ?? subStep.error?.message);

    if (message) {
      messages.add(message);
    }
    collectSubStepMessages(subStep.steps, messages);
  }
  return messages;
};

/**
 * Report data marks steps and fixtures whose error repeats one of the nested steps (`hasSimilarErrorInSubSteps`).
 * Data without the flag (older reports) falls back to the same check over the nested steps.
 */
export const hasSimilarErrorInSubSteps = (step: StepWithError) => {
  if (typeof step.hasSimilarErrorInSubSteps === "boolean") {
    return step.hasSimilarErrorInSubSteps;
  }

  const message = normalizeErrorText(getStepError(step).message);

  return Boolean(message) && collectSubStepMessages(step.steps, new Set()).has(message);
};

export const shouldShowStepError = (step: StepWithError) =>
  isDisplayableTestError(getStepError(step)) && !hasSimilarErrorInSubSteps(step);

export type FailedSubStepCounts = Partial<Record<"failed" | "broken", number>>;

export const countFailedSubSteps = (steps: TestStepResult[] | undefined): FailedSubStepCounts => {
  const result: FailedSubStepCounts = {};
  const visit = (subSteps: TestStepResult[] | undefined) => {
    for (const subStep of subSteps ?? []) {
      if (subStep.type !== "step") {
        continue;
      }
      if (subStep.status === "failed" || subStep.status === "broken") {
        result[subStep.status] = (result[subStep.status] ?? 0) + 1;
      }
      visit(subStep.steps);
    }
  };

  visit(steps);

  return result;
};

export const hasFailedFixture = (fixtures: { status?: TestStatus }[] | undefined) =>
  Boolean(fixtures?.some(({ status }) => status === "failed" || status === "broken"));
