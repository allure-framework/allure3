import type {
  AttachmentTestStepResult,
  HistoryTestResult,
  Statistic,
  TestFixtureResult,
  TestResult,
  TestStatus,
  TestStepResult,
} from "@allurereport/core-api";
import { filterIncludedInSuccessRate, isStep } from "@allurereport/core-api";
import { matchCategories } from "./categories.js";
import type {
  Allure2Attachment,
  Allure2Category,
  Allure2HistoryData,
  Allure2HistoryItem,
  Allure2RetryItem,
  Allure2SeverityLevel,
  Allure2StageResult,
  Allure2Status,
  Allure2Step,
  Allure2TestResult,
  Allure2Time,
} from "./model.js";
import { severityValues } from "./model.js";
import { updateStatistic } from "./utils.js";

type ConvertContext = {
  // id -> source
  attachmentMap: Map<string, string>;
  fixtures: TestFixtureResult[];
  categories: Allure2Category[];
  retries: TestResult[];
  history: HistoryTestResult[];
};

const sortByTime = (a: { time: Allure2Time }, b: { time: Allure2Time }): number =>
  a.time.start !== undefined && b.time.start !== undefined ? a.time.start - b.time.start : 0;

const convertStatus = (status: TestStatus): Allure2Status => status;

const convertStageResult = (context: ConvertContext, result: TestResult | TestFixtureResult): Allure2StageResult => {
  const { name, ...testStage } = convertStep(context, {
    name: "test",
    steps: result.steps,
    start: result.start,
    stop: result.stop,
    duration: result.duration,
    status: result.status,
    parameters: [],
    type: "step",
  });
  return testStage;
};

const convertStep = (context: ConvertContext, step: TestStepResult): Allure2Step => {
  if (isStep(step)) {
    const name = step.name;
    const steps = step.steps.map((child) => convertStep(context, child));
    const stepsCount = steps.length;
    const parameters = step.parameters;
    const parametersCount = parameters.length;
    const statusMessage = step.message;
    const shouldDisplayMessage = !!statusMessage || steps.findIndex((s) => s.statusMessage === statusMessage) > 0;
    return {
      name,
      time: {
        start: step.start,
        stop: step.stop,
        duration: step.duration,
      },
      status: step.status,
      statusMessage,
      statusTrace: step.trace,
      steps,
      attachments: [],
      parameters,
      stepsCount,
      attachmentsCount: 0,
      hasContent: stepsCount + parametersCount > 0 || shouldDisplayMessage,
      shouldDisplayMessage,
      attachmentStep: false,
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

const importantStatuses = ["failed", "broken", "passed"];

export const convertTestResult = (context: ConvertContext, test: TestResult): Allure2TestResult => {
  const testStage = convertStageResult(context, test);

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
  const statusMessage = test.message;
  const statusTrace = test.trace;
  const flaky = false;

  const categories = matchCategories(context.categories, { statusMessage, statusTrace, status, flaky });

  const retries: Allure2RetryItem[] = context.retries.map((retry) => ({
    uid: retry.id,
    status: convertStatus(retry.status),
    statusDetails: retry.message,
    time: {
      start: retry.start,
      stop: retry.stop,
      duration: retry.duration,
    },
  }));

  const retriesStatusChange =
    status in importantStatuses &&
    retries.find((tr) => tr.status in importantStatuses && tr.status !== status) !== undefined;

  const lastHistoryStatus = context.history.find(filterIncludedInSuccessRate)?.status;
  const newFailed = lastHistoryStatus === "passed" && test.status === "failed";
  const newBroken = lastHistoryStatus === "passed" && test.status === "broken";
  const newPassed = lastHistoryStatus !== undefined && lastHistoryStatus !== "passed" && test.status === "passed";

  const historyItems: Allure2HistoryItem[] = context.history.map((htr) => ({
    uid: htr.id,
    status: convertStatus(htr.status),
    // TODO fix reportUrl
    reportUrl: "unsupported",
    statusDetails: htr.message,
    time: {
      start: htr.start,
      stop: htr.stop,
      duration: htr.duration,
    },
  }));

  const statistic: Statistic = { total: 0 };
  historyItems.forEach((historyItem) => updateStatistic(statistic, historyItem));

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
    links: test.links,
    parameters: test.parameters,
    afterStages,
    beforeStages,
    testStage: testStage,
    flaky,
    hidden: test.hidden,
    newFailed,
    newBroken,
    newPassed,
    retry: test.hidden,
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
