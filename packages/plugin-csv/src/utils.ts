import type { TestResult, TestStepResult } from "@allurereport/core-api";
import { formatDuration } from "@allurereport/core-api";

export const formatSteps = (tr: TestResult): string | undefined => {
  if (tr.steps.length === 0) {
    return undefined;
  }

  return tr.steps
    .map(formatStep)
    .filter((s) => s)
    .join("\n");
};

const formatStep = (step: TestStepResult, indent: number = 0): string | undefined => {
  if (step.type !== "step") {
    return undefined;
  }

  const prefix = " ".repeat(indent);
  const res = [
    `${prefix}${step.name} ${step.status} (${formatDuration(step.duration)})`,
    ...step.steps.map((s) => formatStep(s, indent + 2)).filter((s) => s),
  ];

  return res.join("\n");
};

export const labelValue = (name: string): ((result: TestResult) => string | undefined) => {
  return (result) =>
    result.labels
      .filter((l) => l.name === name)
      .map((l) => l.value)
      .filter((v) => v)
      .map((v) => v!)
      .sort()
      .join(",");
};
