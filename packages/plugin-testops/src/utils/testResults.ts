import type { AttachmentLink, TestStepResult } from "@allurereport/core-api";

import type {
  UploadResultsDto,
  UploadTestResultCategoryGroupingDto,
  UploadTestResultDto,
  UploadTestResultStepDto,
} from "../model.js";
import type { TestOpsPluginTestResult } from "../model.js";
import { toUploadAttachmentDto } from "./attachments.js";
import { validateExecutableName } from "./validation.js";

export const normalizeTestStepsResults = (steps: TestStepResult[] | undefined): TestStepResult[] | undefined => {
  if (!steps) {
    return undefined;
  }

  const projected: TestStepResult[] = [];

  for (const step of steps) {
    if (step.type === "attachment") {
      projected.push(step);
    } else if (validateExecutableName(step.name)) {
      projected.push({ ...step, ...(step.steps ? { steps: normalizeTestStepsResults(step.steps) } : {}) });
    }
  }

  return projected;
};

const toUploadStepDto = (step: TestStepResult): UploadTestResultStepDto => {
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

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const hasString = (obj: Record<string, unknown>, key: string): obj is Record<string, string> =>
  typeof obj[key] === "string";

const normalizeCategory = (
  category: TestOpsPluginTestResult["category"],
): UploadTestResultDto["category"] | undefined => {
  if (!category) return undefined;
  const externalIdUnknown: unknown = (category as unknown as { externalId?: unknown }).externalId;
  const groupingUnknown: unknown = (category as unknown as { grouping?: unknown }).grouping;
  const externalId =
    typeof externalIdUnknown === "string"
      ? externalIdUnknown
      : typeof externalIdUnknown === "number"
        ? String(externalIdUnknown)
        : undefined;

  if (!externalId) {
    return undefined;
  }

  const grouping: UploadTestResultCategoryGroupingDto[] | undefined = Array.isArray(groupingUnknown)
    ? groupingUnknown
        .filter(isObject)
        .map((g) => ({
          key: hasString(g, "key") ? g.key : undefined,
          value: hasString(g, "value") ? g.value : undefined,
          name: hasString(g, "name") ? g.name : undefined,
        }))
        .filter((g) => g.key || g.value || g.name)
    : undefined;

  return { externalId, ...(grouping && grouping.length > 0 ? { grouping } : {}) };
};

const optionalArray = <T>(v: unknown, isItem: (x: unknown) => x is T): T[] | undefined => {
  if (!Array.isArray(v)) {
    return undefined;
  }

  return v.filter(isItem);
};

const isAttachmentLink = (v: unknown): v is AttachmentLink => isObject(v) && hasString(v, "id");

export const toUploadTestResultDto = (tr: TestOpsPluginTestResult): UploadTestResultDto => {
  const attachments = optionalArray((tr as unknown as Record<string, unknown>).attachments, isAttachmentLink)?.map(
    toUploadAttachmentDto,
  );
  const category = normalizeCategory(tr.category);

  return {
    uuid: tr.id,
    historyId: tr.historyId,
    testCaseId: tr.testCase?.externalId,
    name: tr.name,
    fullName: tr.fullName,
    description: tr.description,
    descriptionHtml: tr.descriptionHtml,
    precondition: tr.precondition,
    preconditionHtml: tr.preconditionHtml,
    expectedResult: tr.expectedResult,
    expectedResultHtml: tr.expectedResultHtml,
    start: tr.start,
    stop: tr.stop,
    duration: tr.duration,
    status: tr.status,
    message: (tr as { message?: string }).message,
    trace: (tr as { trace?: string }).trace,
    hostId: tr.hostId,
    threadId: tr.threadId,
    environment: tr.environment,
    ...(category ? { category } : {}),
    ...(typeof tr.namedEnv?.id === "number" ? { namedEnv: { id: tr.namedEnv.id } } : {}),
    steps: tr.steps?.map(toUploadStepDto),
    ...(attachments ? { attachments } : {}),
    parameters: tr.parameters,
    links: tr.links,
    labels: tr.labels,
  };
};

export const toUploadResultsDto = (testSessionId: number, trs: TestOpsPluginTestResult[]): UploadResultsDto => ({
  testSessionId,
  results: trs.map(toUploadTestResultDto),
});
