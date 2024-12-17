import type { AttachmentTestStepResult, DefaultTestStepResult, TestStepResult } from "../model.js";

export const isStep = (result: TestStepResult): result is DefaultTestStepResult => {
  return result.type === "step";
};

export const isAttachment = (result: TestStepResult): result is AttachmentTestStepResult => {
  return result.type === "attachment";
};
