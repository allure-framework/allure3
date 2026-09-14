import type {
  AttachmentTestStepResult,
  HistoryTestResult,
  TestFixtureResult,
  TestResult,
  TestStatus,
  TestStepResult,
} from "@allurereport/core-api";
import { isStep, redactParameters } from "@allurereport/core-api";

import { matchCategories } from "./categories.js";
import type {
  Allure2Attachment,
  Allure2Category,
  Allure2HistoryData,
  Allure2HistoryItem,
  Allure2Link,
  Allure2RetryItem,
  Allure2SeverityLevel,
  Allure2StageResult,
  Allure2Status,
  Allure2Step,
  Allure2TestResult,
  Allure2Time,
} from "./model.js";
import { severityValues } from "./model.js";
import { createStatistic, updateStatistic } from "./utils.js";

type ConvertContext = {
  // id -> source
  attachmentMap: Map<string, string>;
  fixtures: TestFixtureResult[];
  categories: Allure2Category[];
  retries: TestResult[];
  history: HistoryTestResult[];
  legacyHistory?: Allure2HistoryData;
};

const sortByTime = (a: { time: Allure2Time }, b: { time: Allure2Time }): number =>
  a.time.start !== undefined && b.time.start !== undefined ? a.time.start - b.time.start : 0;

const convertStatus = (status: TestStatus): Allure2Status => status;

const getTopLevelAttachmentCount = (result: TestResult | TestFixtureResult): number => {
  if (result.sourceMetadata.readerId !== "allure2") {
    return 0;
  }

  const value = result.sourceMetadata.metadata.allure2_top_level_attachment_count;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
};

const hasMessage = (step: Allure2Step, message: string): boolean =>
  step.statusMessage === message || step.steps.some((child) => hasMessage(child, message));

const summarize = (
  name: string | undefined,
  statusMessage: string | undefined,
  steps: Allure2Step[],
  attachments: Allure2Attachment[],
  parametersCount: number,
) => {
  const stepsCount = steps.reduce((count, step) => count + 1 + step.stepsCount, 0);
  const attachmentsCount = attachments.length + steps.reduce((count, step) => count + step.attachmentsCount, 0);
  const shouldDisplayMessage = !!statusMessage && !steps.some((step) => hasMessage(step, statusMessage));

  return {
    stepsCount,
    attachmentsCount,
    shouldDisplayMessage,
    hasContent: steps.length + attachments.length + parametersCount > 0 || shouldDisplayMessage,
    attachmentStep: stepsCount === 0 && attachmentsCount === 1 && name !== undefined && name === attachments[0]?.name,
  };
};

const convertStageResult = (context: ConvertContext, result: TestResult | TestFixtureResult): Allure2StageResult => {
  const topLevelAttachmentCount = Math.min(getTopLevelAttachmentCount(result), result.steps.length);
  const attachmentStart = result.steps.length - topLevelAttachmentCount;
  const attachmentCandidates = result.steps.slice(attachmentStart);
  const stageSteps = [
    ...result.steps.slice(0, attachmentStart),
    ...attachmentCandidates.filter((step) => isStep(step)),
  ];
  const attachments = attachmentCandidates
    .filter((step): step is AttachmentTestStepResult => !isStep(step))
    .map((step) => convertAttachment(context, step));
  const steps = stageSteps.map((step) => convertStep(context, step));
  const name = "type" in result ? result.name : undefined;
  const statusMessage = result.error?.message;
  const summary = summarize(name, statusMessage, steps, attachments, 0);

  return {
    ...(name === undefined ? {} : { name }),
    time: {
      start: result.start,
      stop: result.stop,
      duration: result.duration,
    },
    status: result.status,
    statusMessage,
    statusTrace: result.error?.trace,
    steps,
    attachments,
    parameters: [],
    ...summary,
  };
};

const convertStep = (context: ConvertContext, step: TestStepResult): Allure2Step => {
  if (isStep(step)) {
    const name = step.name;
    const steps = step.steps.filter((child) => isStep(child)).map((child) => convertStep(context, child));
    const attachments = step.steps
      .filter((child): child is AttachmentTestStepResult => !isStep(child))
      .map((child) => convertAttachment(context, child));
    const parameters = redactParameters(step.parameters);
    const statusMessage = step.error?.message ?? step.message;
    const summary = summarize(name, statusMessage, steps, attachments, parameters.length);

    return {
      name,
      time: {
        start: step.start,
        stop: step.stop,
        duration: step.duration,
      },
      status: step.status,
      statusMessage,
      statusTrace: step.error?.trace ?? step.trace,
      steps,
      attachments,
      parameters,
      ...summary,
    };
  }
  // step is attachment, so wrap it with attachment meta step.
  const stepName = step.link.name;
  return {
    name: stepName,
    time: {},
    status: "unknown",
    steps: [],
    attachments: [
      {
        ...convertAttachment(context, step),
      },
    ],
    parameters: [],
    stepsCount: 0,
    attachmentsCount: 1,
    hasContent: true,
    shouldDisplayMessage: false,
    attachmentStep: true,
  };
};

const convertAttachment = (context: ConvertContext, { link }: AttachmentTestStepResult): Allure2Attachment => ({
  uid: link.id,
  name: link.name,
  source: context.attachmentMap.get(link.id) ?? link.originalFileName,
  type: link.contentType,
  size: !link.missed ? link.contentLength : undefined,
});

const findAllLabels = (test: TestResult, labelName: string): string[] => {
  return test.labels
    .filter((label) => label.name === labelName)
    .map((label) => label.value)
    .filter((value) => value)
    .map((value) => value!);
};

const findLabelValue = (test: TestResult, labelName: string): string | undefined => {
  return test.labels.find((label) => label.name === labelName)?.value;
};

const extractSeverity = (test: TestResult): Allure2SeverityLevel => {
  const maybeSeverity = findLabelValue(test, "severity")?.toLowerCase();
  return (maybeSeverity ? severityValues.find((value) => value === maybeSeverity) : undefined) ?? "normal";
};

const importantStatuses: Allure2Status[] = ["failed", "broken", "passed"];

const isImportantStatus = (status: Allure2Status): boolean => importantStatuses.includes(status);

const getAllure2Links = (test: TestResult): Allure2Link[] | undefined => {
  if (test.sourceMetadata.readerId !== "allure2") {
    return undefined;
  }

  const links = test.sourceMetadata.metadata.allure2_links;
  if (!Array.isArray(links)) {
    return undefined;
  }

  return links.map((link) => ({
    name: typeof link?.name === "string" ? link.name : undefined,
    url: typeof link?.url === "string" ? link.url : undefined,
    type: typeof link?.type === "string" ? link.type : undefined,
  }));
};

const isFlakyFromHistory = (currentStatus: Allure2Status, historyItems: Allure2HistoryItem[]): boolean => {
  if (currentStatus !== "failed" && currentStatus !== "broken") {
    return false;
  }

  const statuses = historyItems.slice(0, 5).map(({ status }) => status);
  return statuses.includes("passed") && statuses.indexOf("passed") < statuses.lastIndexOf("failed");
};

export const convertTestResult = (context: ConvertContext, test: TestResult): Allure2TestResult => {
  const testStage = test.steps.length > 0 ? convertStageResult(context, test) : null;

  const beforeStages = context.fixtures
    .filter((value) => value.type === "before")
    .map((fixture) => convertStageResult(context, fixture))
    .sort(sortByTime);

  const afterStages = context.fixtures
    .filter((value) => value.type === "after")
    .map((fixture) => convertStageResult(context, fixture))
    .sort(sortByTime);

  const owner = findLabelValue(test, "owner");
  const severity = extractSeverity(test);
  const tags = findAllLabels(test, "tag");

  const status = convertStatus(test.status);
  const statusMessage = test.error?.message;
  const statusTrace = test.error?.trace;
  const retries: Allure2RetryItem[] = context.retries.map((retry) => ({
    uid: retry.id,
    status: convertStatus(retry.status),
    statusDetails: retry?.error?.message,
    time: {
      start: retry.start,
      stop: retry.stop,
      duration: retry.duration,
    },
  }));

  const retriesStatusChange =
    isImportantStatus(status) &&
    retries.find((retry) => isImportantStatus(retry.status) && retry.status !== status) !== undefined;

  const historyItems: Allure2HistoryItem[] = context.legacyHistory
    ? context.legacyHistory.items.map((item) => ({
        uid: item.uid,
        status: item.status,
        reportUrl: item.reportUrl,
        statusDetails: item.statusDetails,
        time: { ...item.time },
      }))
    : context.history.map((historyTestResult) => ({
        uid: historyTestResult.id,
        status: convertStatus(historyTestResult.status),
        reportUrl: historyTestResult.url,
        statusDetails: historyTestResult.error?.message,
        time: {
          start: historyTestResult.start,
          stop: historyTestResult.stop,
          duration: historyTestResult.duration,
        },
      }));

  const lastHistoryStatus = historyItems.find(({ status: historyStatus }) => isImportantStatus(historyStatus))?.status;
  const newFailed = lastHistoryStatus === "passed" && test.status === "failed";
  const newBroken = lastHistoryStatus === "passed" && test.status === "broken";
  const newPassed = lastHistoryStatus !== undefined && lastHistoryStatus !== "passed" && test.status === "passed";
  const flaky = test.flaky || isFlakyFromHistory(status, historyItems);

  const categories = matchCategories(context.categories, { statusMessage, statusTrace, status, flaky });

  const statistic = createStatistic(context.legacyHistory?.statistic);
  if (!context.legacyHistory) {
    historyItems.forEach((historyItem) => updateStatistic(statistic, historyItem));
  }
  updateStatistic(statistic, test);

  const history: Allure2HistoryData = {
    statistic,
    items: historyItems,
  };

  return {
    uid: test.id,
    name: test.name,
    fullName: test.fullName,
    historyId: test.historyId,
    testId: test.testCase?.id,
    time: {
      start: test.start,
      stop: test.stop,
      duration: test.duration,
    },
    status,
    description: test.description,
    descriptionHtml: test.descriptionHtml,
    statusMessage,
    statusTrace,
    labels: test.labels,
    links: getAllure2Links(test) ?? test.links,
    parameters: redactParameters(test.parameters),
    afterStages,
    beforeStages,
    testStage: testStage,
    flaky,
    isRetry: test.isRetry,
    newFailed,
    newBroken,
    newPassed,
    retry: test.isRetry,
    retriesStatusChange,
    retriesCount: retries.length,
    hostId: test.hostId,
    threadId: test.threadId,
    extra: {
      owner,
      severity,
      tags,
      categories,
      retries,
      history,
    },
  };
};
