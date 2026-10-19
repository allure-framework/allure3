import type { UploadFixturesResultsDto, UploadTestFixtureResultDto } from "../model.js";
import type { TestOpsFixtureResult } from "../model.js";
import { toUploadStepDto } from "./steps.js";

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
