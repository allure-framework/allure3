import type { TestStepResult } from "@allurereport/core-api";

export const unwrapStepsAttachments = (steps: TestStepResult[]): TestStepResult[] => {
  return steps.map((step) => {
    if (step.type === "attachment") {
      return {
        ...step,
        attachment: step.link,
      };
    }

    if (step.steps) {
      return {
        ...step,
        steps: unwrapStepsAttachments(step.steps),
      };
    }

    return step;
  });
};
