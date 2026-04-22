import type { AttachmentLink, TestStepResult } from "@allurereport/core-api";

import type {
  UploadAttachmentDto,
  UploadFixturesResultsDto,
  UploadResultsDto,
  UploadTestFixtureResultDto,
  UploadTestResultDto,
  UploadTestResultCategoryGroupingDto,
  UploadTestResultStepDto,
} from "./model.js";
import type { TestOpsFixtureResult, TestOpsPluginTestResult } from "./model.js";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const hasString = (obj: Record<string, unknown>, key: string): obj is Record<string, string> =>
  typeof obj[key] === "string";

export const uploadFilenameForLink = (link: AttachmentLink): string | undefined => {
  if ("originalFileName" in link && typeof link.originalFileName === "string") return link.originalFileName;
  return undefined;
};

export const toUploadAttachmentDto = (link: AttachmentLink): UploadAttachmentDto => {
  return {
    name: "name" in link && typeof link.name === "string" ? link.name : undefined,
    originalFileName: uploadFilenameForLink(link),
    contentType: "contentType" in link && typeof link.contentType === "string" ? link.contentType : undefined,
    contentLength: "contentLength" in link && typeof link.contentLength === "number" ? link.contentLength : undefined,
    optional:
      "optional" in link && typeof (link as { optional?: unknown }).optional === "boolean"
        ? (link as { optional: boolean }).optional
        : undefined,
  };
};

const toUploadStepDto = (step: TestStepResult): UploadTestResultStepDto => {
  if (step.type === "attachment") {
    return {
      type: "attachment",
      attachment: toUploadAttachmentDto(step.link),
    };
  }

  // step.type === "step"
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

  if (!externalId) return undefined;

  const grouping: UploadTestResultCategoryGroupingDto[] | undefined = Array.isArray(groupingUnknown)
    ? groupingUnknown
        .filter(isObject)
        .map(
          (g): UploadTestResultCategoryGroupingDto => ({
            key: hasString(g, "key") ? g.key : undefined,
            value: hasString(g, "value") ? g.value : undefined,
            name: hasString(g, "name") ? g.name : undefined,
          }),
        )
        .filter((g) => g.key || g.value || g.name)
    : undefined;

  return {
    externalId,
    ...(grouping && grouping.length > 0 ? { grouping } : {}),
  };
};

const optionalArray = <T>(v: unknown, isItem: (x: unknown) => x is T): T[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out: T[] = [];
  for (const item of v) {
    if (isItem(item)) out.push(item);
  }
  return out;
};

const isAttachmentLink = (v: unknown): v is AttachmentLink => isObject(v) && hasString(v, "id");

export const toUploadTestResultDto = (tr: TestOpsPluginTestResult): UploadTestResultDto => {
  const attachmentsUnknown = (tr as unknown as Record<string, unknown>).attachments;

  const attachments = optionalArray(attachmentsUnknown, isAttachmentLink)?.map(toUploadAttachmentDto);

  return {
    uuid: tr.id,
    historyId: tr.historyId,
    testCaseId: tr.testCase?.id,
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
    ...(normalizeCategory(tr.category) ? { category: normalizeCategory(tr.category) } : {}),
    ...(typeof tr.namedEnv?.id === "number" ? { namedEnv: { id: tr.namedEnv.id } } : {}),
    steps: tr.steps?.map(toUploadStepDto),
    ...(attachments ? { attachments } : {}),
    parameters: tr.parameters,
    links: tr.links,
    labels: tr.labels,
  };
};

export const toUploadResultsDto = (testSessionId: number, trs: TestOpsPluginTestResult[]): UploadResultsDto => {
  return {
    testSessionId,
    results: trs.map(toUploadTestResultDto),
  };
};

export const toUploadFixtureResultDto = (fxt: TestOpsFixtureResult): UploadTestFixtureResultDto => {
  return {
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
  };
};

export const toUploadFixturesResultsDto = (fixtures: TestOpsFixtureResult[]): UploadFixturesResultsDto => {
  return { fixtures: fixtures.map(toUploadFixtureResultDto) };
};
