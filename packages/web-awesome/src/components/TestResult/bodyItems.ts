import type { AttachmentTestStepResult, DefaultTestStepResult, TestError, TestStatus } from "@allurereport/core-api";
import type { AwesomeTestResult } from "types";

export type TestLevelErrorItem = {
  type: "error";
  id: string;
  title: string;
  status: TestStatus;
  error: TestError;
};

export type TrStepItem = {
  type: "step";
  item: DefaultTestStepResult;
  bodyItems: TrBodyItem[];
  suppressInlineError: boolean;
};

export type TrBodyItem = TrStepItem | AttachmentTestStepResult | TestLevelErrorItem;

type TestErrorLike = Pick<TestError, "message" | "trace" | "actual" | "expected">;

type BuildResult = {
  bodyItems: TrBodyItem[];
  didPlaceSyntheticError: boolean;
};

// Same pattern as @allurereport/web-commons stripAnsi — kept inline to avoid
// module-resolution issues in the vitest/webpack dual environment.
// eslint-disable-next-line no-control-regex
const ansiRegex = /\x1B\[[0-9;?]*[ -/]*[@-~]/g;

export const getTestLevelErrorId = (testResultId: string) => `__test-error__:${testResultId}`;

const normalizeErrorText = (value?: string) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(ansiRegex, "").trim();
};

const getTestLevelErrorTitle = (message?: string) => {
  return (
    normalizeErrorText(message)
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""
  );
};

export const hasErrorDiff = (error?: TestErrorLike) =>
  Boolean(error?.actual) && error.actual !== "undefined" && Boolean(error?.expected) && error.expected !== "undefined";

export const hasTestLevelErrorContent = (error?: TestErrorLike) =>
  Boolean(normalizeErrorText(error?.trace).length) || hasErrorDiff(error);

const isDisplayableTestError = (error?: TestErrorLike) => {
  return (
    Boolean(normalizeErrorText(error?.message).length) ||
    Boolean(normalizeErrorText(error?.trace).length) ||
    hasErrorDiff(error)
  );
};

const canHostSyntheticError = (step: DefaultTestStepResult, error: TestErrorLike) => {
  if (step.status !== "failed" && step.status !== "broken") {
    return false;
  }

  const stepMessage = normalizeErrorText(step.message);
  const errorMessage = normalizeErrorText(error.message);

  if (stepMessage && errorMessage) {
    return stepMessage === errorMessage;
  }

  const stepTrace = normalizeErrorText(step.trace);
  const errorTrace = normalizeErrorText(error.trace);

  return Boolean(stepTrace) && Boolean(errorTrace) && stepTrace === errorTrace;
};

const createTestLevelErrorItem = (
  testResultId: string,
  status: TestStatus,
  error: TestError,
  fallbackTitle: string,
): TestLevelErrorItem => ({
  type: "error",
  id: getTestLevelErrorId(testResultId),
  title: getTestLevelErrorTitle(error.message) || fallbackTitle,
  status,
  error,
});

const buildStepBodyItems = (
  steps: AwesomeTestResult["steps"],
  syntheticErrorItem: TestLevelErrorItem | undefined,
): BuildResult => {
  const bodyItems: TrBodyItem[] = [];
  let didPlaceSyntheticError = false;

  for (const step of steps) {
    if (step.type === "attachment") {
      bodyItems.push(step);
      continue;
    }

    const nestedResult = buildStepBodyItems(step.steps, syntheticErrorItem);
    const shouldHostSyntheticError =
      Boolean(syntheticErrorItem) &&
      !nestedResult.didPlaceSyntheticError &&
      canHostSyntheticError(step, syntheticErrorItem.error);

    bodyItems.push({
      type: "step",
      item: step,
      bodyItems: shouldHostSyntheticError ? [...nestedResult.bodyItems, syntheticErrorItem] : nestedResult.bodyItems,
      suppressInlineError: shouldHostSyntheticError,
    });

    if (nestedResult.didPlaceSyntheticError || shouldHostSyntheticError) {
      didPlaceSyntheticError = true;
    }
  }

  return { bodyItems, didPlaceSyntheticError };
};

export const getBodyItems = (
  testResult?: Pick<AwesomeTestResult, "id" | "status" | "steps" | "error">,
  fallbackTitle = "Error",
): TrBodyItem[] => {
  if (!testResult) {
    return [];
  }

  const syntheticErrorItem =
    (testResult.status === "failed" || testResult.status === "broken") && isDisplayableTestError(testResult.error)
      ? createTestLevelErrorItem(testResult.id, testResult.status, testResult.error, fallbackTitle)
      : undefined;

  const { bodyItems, didPlaceSyntheticError } = buildStepBodyItems(testResult.steps, syntheticErrorItem);

  if (syntheticErrorItem && !didPlaceSyntheticError) {
    return [...bodyItems, syntheticErrorItem];
  }

  return bodyItems;
};
