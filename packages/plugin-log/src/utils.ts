import type { DefaultTestStepResult, TestResult, TestStatus, TestStepResult } from "@allurereport/core-api";
import { isStep } from "@allurereport/core-api";
import console from "node:console";
import { gray, green, red, yellow } from "yoctocolors";
import type { LogPluginOptions } from "./model.js";

export type PrintFunctionOptions = Pick<LogPluginOptions, "allSteps" | "groupBy" | "withTrace">;

export const isFailedResult = (result: TestResult | TestStepResult): boolean => {
  if ("status" in result) {
    return result.status === "failed" || result.status === "broken";
  }
  // attachments only
  return false;
};

export const hasResultFailedSteps = (result: TestResult | TestStepResult): boolean => {
  if (!("steps" in result)) {
    return false;
  }

  return result.steps?.some((step) => {
    if (isFailedResult(step)) {
      return true;
    }

    if (step.type === "step" && step?.steps) {
      return hasResultFailedSteps(step);
    }

    return false;
  });
};

export const stringifyStatusBadge = (status: TestStatus) => {
  switch (status) {
    case "passed":
      return green("✓");
    case "failed":
      return red("⨯");
    case "broken":
      return red("⨯");
    case "skipped":
      return gray("-");
    case "unknown":
      return gray("?");
  }
};

export const stringifyTestResultTitle = (result: TestResult) => {
  const status = stringifyStatusBadge(result.status);
  const name: string = result.name;
  const duration = result.duration ? `${yellow(`${result.duration}ms`)}` : "";

  return [status, name, duration].filter(Boolean).join(" ");
};

export const stringifyStepResultTitle = (result: DefaultTestStepResult) => {
  const status = stringifyStatusBadge(result.status);
  const duration = result.duration ? `${yellow(`${result.duration}ms`)}` : "";

  return [status, result.name, duration].filter(Boolean).join(" ");
};

export const printTest = (test: TestResult, options?: PrintFunctionOptions, indent: number = 0) => {
  const title = stringifyTestResultTitle(test);
  const stepsToPrint = options?.allSteps ? test.steps.filter(isStep) : test.steps.filter(isFailedResult).filter(isStep);
  const failedResult = isFailedResult(test);
  const indentSpaces = "  ".repeat(indent);

  console.info(`${indentSpaces}${title}`);

  if (failedResult && test.error?.message) {
    console.info(`${indentSpaces}  ${red(test.error.message)}`);
  }

  if (options?.withTrace && failedResult && test.error?.trace) {
    test.error.trace.split("\n").forEach((line) => {
      console.info(`${indentSpaces}  ${gray(line)}`);
    });
  }

  if (!stepsToPrint?.length) {
    return;
  }

  stepsToPrint.forEach((step) => {
    printStep(step, options, indent + 1);
  });
};

export const printStep = (step: DefaultTestStepResult, options?: PrintFunctionOptions, indent: number = 0) => {
  const title = stringifyStepResultTitle(step);
  const stepsToPrint =
    (options?.allSteps ? step.steps.filter(isStep) : step.steps?.filter(isStep).filter(isFailedResult)) || [];
  const indentSpaces = "  ".repeat(indent);
  const failedResult = isFailedResult(step);

  console.info(`${indentSpaces}${title}`);

  if (failedResult && step.error?.message) {
    console.info(`  ${indentSpaces}${red(step.error?.message)}`);
  }

  if (options?.withTrace && failedResult && step.error?.trace) {
    step.error.trace.split("\n").forEach((line) => {
      console.info(`  ${indentSpaces}${gray(line)}`);
    });
  }

  if (!stepsToPrint?.length) {
    return;
  }

  stepsToPrint.forEach((child) => {
    printStep(child, options, indent + 1);
  });
};

export const printSummary = (results: TestResult[]) => {
  const statsCounters = {
    passed: 0,
    failed: 0,
    broken: 0,
    skipped: 0,
  };
  let totalDuration = 0;

  results.forEach((test) => {
    totalDuration += test.duration || 0;

    switch (test.status) {
      case "passed":
        statsCounters.passed++;
        break;
      case "failed":
        statsCounters.failed++;
        break;
      case "broken":
        statsCounters.broken++;
        break;
      case "skipped":
        statsCounters.skipped++;
        break;
    }
  });

  const stringifiedCounters: string[] = [];

  if (statsCounters.passed > 0) {
    stringifiedCounters.push(green(`${statsCounters.passed} passed`));
  }

  if (statsCounters.failed > 0) {
    stringifiedCounters.push(red(`${statsCounters.failed} failed`));
  }

  if (statsCounters.broken > 0) {
    stringifiedCounters.push(red(`${statsCounters.broken} broken`));
  }

  if (statsCounters.skipped > 0) {
    stringifiedCounters.push(yellow(`${statsCounters.skipped} skipped`));
  }

  if (results.length === 0) {
    console.info("No test results found to show");
    return;
  }

  console.info(`Total tests: ${results.length}`);
  console.info(`Tests: ${stringifiedCounters.join(" | ")}`);
  console.info(`Duration: ${yellow((totalDuration / 1000).toString())}s`);
};
