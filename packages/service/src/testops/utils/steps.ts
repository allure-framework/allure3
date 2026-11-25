import type { TestStepResult } from "@allurereport/core-api";

import type { UploadTestResultStepDto } from "../model.js";
import { toUploadAttachmentDto } from "./attachments.js";

export const toUploadStepDto = (step: TestStepResult): UploadTestResultStepDto => {
  if (step.type === "attachment") {
    return { type: "attachment", attachment: toUploadAttachmentDto(step.link) };
  }

  return {
    type: "body",
    body: step.name,
    status: step.status,
    start: step.start,
    stop: step.stop,
    duration: step.duration,
    message: typeof step.message === "string" ? step.message : undefined,
    trace: typeof step.trace === "string" ? step.trace : undefined,
    parameters: step.parameters,
    steps: step.steps?.map(toUploadStepDto),
  };
};
