import type { TestStepResult } from "@allurereport/core-api";

import type { UploadFixturesResultsDto, UploadTestFixtureResultDto, UploadTestResultStepDto } from "../model.js";
import type { TestOpsFixtureResult } from "../model.js";
import { toUploadAttachmentDto } from "./attachments.js";

const toUploadStepDto = (step: TestStepResult): UploadTestResultStepDto =>
  step.type === "attachment"
    ? { type: "attachment" as const, attachment: toUploadAttachmentDto(step.link) }
    : {
        type: "body" as const,
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

export const toUploadFixtureResultDto = (fxt: TestOpsFixtureResult): UploadTestFixtureResultDto => ({
  type: fxt.type,
  uuid: fxt.id,
  name: fxt.name,
  start: fxt.start,
  stop: fxt.stop,
  duration: fxt.duration,
  status: fxt.status,
  message: fxt.error?.message,
  trace: fxt.error?.trace,
  steps: fxt.steps?.map(toUploadStepDto),
});

export const toUploadFixturesResultsDto = (fixtures: TestOpsFixtureResult[]): UploadFixturesResultsDto => ({
  fixtures: fixtures.map(toUploadFixtureResultDto),
});
