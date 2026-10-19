import type { AttachmentTestStepResult, DefaultTestStepResult, TestError, TestStatus } from "@allurereport/core-api";
import type { ReportFixtureResult, ReportTestResult } from "types";

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
  placedErrorIds: Set<string>;
};

// Same pattern as @allurereport/web-commons stripAnsi — kept inline to avoid
// module-resolution issues in the vitest/webpack dual environment.
// eslint-disable-next-line no-control-regex
const ansiRegex = /\x1B\[[0-9;?]*[ -/]*[@-~]/g;

export const getTestLevelErrorId = (testResultId: string) => `__test-error__:${testResultId}`;

export const getTestLevelErrorItemId = (testResultId: string, index: number) =>
  index === 0 ? getTestLevelErrorId(testResultId) : `${getTestLevelErrorId(testResultId)}:${index}`;

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

export const isDisplayableTestError = (error?: TestErrorLike) => {
  return (
    Boolean(normalizeErrorText(error?.message).length) ||
    Boolean(normalizeErrorText(error?.trace).length) ||
    hasErrorDiff(error)
  );
};

export const hasDisplayableTestStatusDetails = (status: TestStatus | undefined, error?: TestErrorLike) => {
  return (status === "failed" || status === "broken" || status === "skipped") && isDisplayableTestError(error);
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
  index: number,
): TestLevelErrorItem => ({
  type: "error",
  id: getTestLevelErrorItemId(testResultId, index),
  title: getTestLevelErrorTitle(error.message) || fallbackTitle,
  status,
  error,
});

const buildStepBodyItems = (
  steps: ReportTestResult["steps"],
  syntheticErrorItems: TestLevelErrorItem[],
): BuildResult => {
  const bodyItems: TrBodyItem[] = [];
  const placedErrorIds = new Set<string>();

  for (const step of steps) {
    if (step.type === "attachment") {
      bodyItems.push(step);
      continue;
    }

    const nestedResult = buildStepBodyItems(step.steps, syntheticErrorItems);
    const hostedErrorItems = syntheticErrorItems.filter(
      (item) =>
        !placedErrorIds.has(item.id) &&
        !nestedResult.placedErrorIds.has(item.id) &&
        canHostSyntheticError(step, item.error),
    );
    const shouldHostSyntheticError = hostedErrorItems.length > 0;
    const stepPlacedErrorIds = new Set(nestedResult.placedErrorIds);

    hostedErrorItems.forEach((item) => stepPlacedErrorIds.add(item.id));

    bodyItems.push({
      type: "step",
      item: step,
      bodyItems: shouldHostSyntheticError ? [...nestedResult.bodyItems, ...hostedErrorItems] : nestedResult.bodyItems,
      suppressInlineError: shouldHostSyntheticError,
    });

    stepPlacedErrorIds.forEach((id) => placedErrorIds.add(id));
  }

  return { bodyItems, placedErrorIds };
};

export const getStepBodyItems = (steps: ReportTestResult["steps"]): TrBodyItem[] =>
  buildStepBodyItems(steps, []).bodyItems;

export const fixtureResultToTrStepItem = (fixture: ReportFixtureResult): TrStepItem => {
  const err = fixture.error;

  return {
    type: "step",
    item: {
      type: "step",
      name: fixture.name,
      status: fixture.status,
      parameters: [],
      steps: fixture.steps,
      stepId: fixture.id,
      duration: fixture.duration,
      message: err?.message,
      trace: err?.trace,
      error: err,
    },
    bodyItems: getStepBodyItems(fixture.steps),
    suppressInlineError: false,
  };
};

export const getBodyItems = (
  testResult?: Pick<ReportTestResult, "id" | "status" | "steps" | "error" | "errors">,
  fallbackTitle = "Error",
): TrBodyItem[] => {
  if (!testResult) {
    return [];
  }

  const errors = testResult.errors?.length ? testResult.errors : testResult.error ? [testResult.error] : [];
  const syntheticErrorItems = errors
    .map((error, index) =>
      hasDisplayableTestStatusDetails(testResult.status, error)
        ? createTestLevelErrorItem(testResult.id, testResult.status, error, fallbackTitle, index)
        : undefined,
    )
    .filter(Boolean) as TestLevelErrorItem[];

  const { bodyItems, placedErrorIds } = buildStepBodyItems(testResult.steps, syntheticErrorItems);
  const unplacedErrorItems = syntheticErrorItems.filter((item) => !placedErrorIds.has(item.id));

  if (unplacedErrorItems.length) {
    return [...bodyItems, ...unplacedErrorItems];
  }

  return bodyItems;
};
