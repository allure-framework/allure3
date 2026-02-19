import type {
  RawStep,
  RawTestAttachment,
  RawTestLabel,
  RawTestLink,
  RawTestParameter,
  RawTestStatus,
  RawTestStepResult,
  ResultsReader,
  ResultsVisitor,
} from "@allurereport/reader-api";
import { XMLParser } from "fast-xml-parser";
import * as console from "node:console";
import { ensureInt, ensureString } from "../utils.js";
import { cleanBadXmlCharacters, isStringAnyRecord, isStringAnyRecordArray } from "../xml-utils.js";

const DEFAULT_TEST_NAME = "The test's name is not defined";
const DEFAULT_STEP_NAME = "The step's name is not defined";

const SUITE_LABEL_NAME = "suite";
const TEST_CLASS_LABEL_NAME = "testClass";
const TEST_METHOD_LABEL_NAME = "testMethod";
const TEST_ID_LABEL_NAME = "testCaseId";
const HISTORY_ID_LABEL_NAME = "historyId";
const STATUS_DETAILS_LABEL_NAME = "status_details";
const ISSUE_LABEL_NAME = "issue";
const TMS_LABEL_NAME = "testId";

const ISSUE_LINK_TYPE = "issue";
const TMS_LINK_TYPE = "tms";

type SuiteData = {
  name?: string;
  title?: string;
  description?: string;
  descriptionHtml?: string;
  labels: readonly RawTestLabel[];
};

const RESERVER_LABEL_NAMES = new Set<string>([
  TEST_CLASS_LABEL_NAME,
  TEST_METHOD_LABEL_NAME,
  TEST_ID_LABEL_NAME,
  HISTORY_ID_LABEL_NAME,
  ISSUE_LABEL_NAME,
  TMS_LABEL_NAME,
  STATUS_DETAILS_LABEL_NAME,
]);

const arrayTags: Set<string> = new Set(["attachment", "label", "parameter", "step", "test-case"]);

const xmlParser = new XMLParser({
  parseTagValue: false,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  allowBooleanAttributes: true,
  processEntities: false,
  isArray: arrayTags.has.bind(arrayTags),
});

const readerId = "allure1";

export const allure1: ResultsReader = {
  read: async (visitor, data) => {
    if (data.getOriginalFileName().endsWith("-testsuite.xml")) {
      try {
        const asBuffer = await data.asBuffer();
        if (!asBuffer) {
          return false;
        }
        const content = cleanBadXmlCharacters(asBuffer).toString("utf-8");
        const parsed = xmlParser.parse(content);
        if (!isStringAnyRecord(parsed)) {
          return false;
        }

        return await parseRootElement(visitor, parsed);
      } catch (e) {
        console.error("error parsing", data.getOriginalFileName(), e);
        return false;
      }
    }
    return false;
  },

  readerId: () => readerId,
};

const parseRootElement = async (visitor: ResultsVisitor, xml: Record<string, any>): Promise<boolean> => {
  const { "test-suite": testSuite } = xml;

  if (!isStringAnyRecord(testSuite)) {
    return false;
  }

  return await parseTestSuite(visitor, testSuite);
};

const parseTestSuite = async (visitor: ResultsVisitor, testSuite: Record<string, any>): Promise<boolean> => {
  const {
    "name": testSuiteName,
    "title": testSuiteTitle,
    "description": descriptionElement,
    "test-cases": testCases,
    "labels": labelsElement,
  } = testSuite;
  if (!isStringAnyRecord(testCases)) {
    return false;
  }

  const { "test-case": testCase } = testCases;

  if (!isStringAnyRecordArray(testCase)) {
    return false;
  }

  const labels = parseLabels(labelsElement);

  for (const tc of testCase) {
    await parseTestCase(
      visitor,
      {
        name: ensureString(testSuiteName),
        title: ensureString(testSuiteTitle),
        ...parseDescription(descriptionElement),
        labels,
      },
      tc,
    );
  }
  return true;
};

const parseTestCase = async (visitor: ResultsVisitor, testSuite: SuiteData, testCase: Record<string, any>) => {
  const {
    name: suiteName,
    title: suiteTitle,
    description: suiteDescription,
    descriptionHtml: suiteDescriptionHtml,
    labels: suiteLabels,
  } = testSuite;
  const {
    name: nameElement,
    title: titleElement,
    description: descriptionElement,
    status: statusElement,
    failure: failureElement,
    parameters: parametersElement,
    steps: stepsElement,
    start: startElement,
    stop: stopElement,
    attachments: attachmentsElement,
    labels: labelsElement,
  } = testCase;

  const testCaseName = ensureString(nameElement);
  const testCaseTitle = ensureString(titleElement);

  const name = testCaseTitle ?? testCaseName ?? DEFAULT_TEST_NAME;
  const status = convertStatus(ensureString(statusElement));

  const { description: testCaseDescription, descriptionHtml: testCaseDescriptionHtml } =
    parseDescription(descriptionElement);
  const description = combineDescriptions(suiteDescription, testCaseDescription, "\n\n");
  const descriptionHtml = combineDescriptions(suiteDescriptionHtml, testCaseDescriptionHtml, "<br>");

  const { start, stop, duration } = parseTime(startElement, stopElement);

  const testCaseLabels = parseLabels(labelsElement);
  const allLabels = [...suiteLabels, ...testCaseLabels];
  const testId = maybeFindLabelValue(allLabels, TEST_ID_LABEL_NAME);
  const historyId = maybeFindLabelValue(allLabels, HISTORY_ID_LABEL_NAME);

  const testClass = resolveTestClass(testCaseLabels, suiteLabels, suiteName, suiteTitle);
  const testMethod = resolveTestMethod(testCaseLabels, testCaseName, testCaseTitle);
  const fullName = getFullName(testClass, testMethod);

  const statusDetailLabels = findAllLabels(allLabels, STATUS_DETAILS_LABEL_NAME);
  const flaky = labelValueExistsIgnoreCase(statusDetailLabels, "flaky");
  const muted = labelValueExistsIgnoreCase(statusDetailLabels, "muted");
  const known = labelValueExistsIgnoreCase(statusDetailLabels, "known");

  const links = [
    ...createLinks(allLabels, ISSUE_LABEL_NAME, ISSUE_LINK_TYPE),
    ...createLinks(allLabels, TMS_LABEL_NAME, TMS_LINK_TYPE),
  ];
  const labels = composeTestResultLabels(allLabels, testClass, testMethod, suiteTitle ?? suiteName);

  const { message, trace } = parseFailure(failureElement);
  const parameters = parseParameters(parametersElement);
  const steps: RawStep[] = [...(parseSteps(stepsElement) ?? []), ...(parseAttachments(attachmentsElement) ?? [])];

  await visitor.visitTestResult(
    {
      name,
      fullName,
      description,
      descriptionHtml,
      testId,
      historyId,
      status,
      start,
      stop,
      duration,
      message,
      trace,
      flaky,
      muted,
      known,
      labels,
      links,
      parameters,
      steps,
    },
    { readerId },
  );
};

const getFullName = (suiteComponent: string | undefined, testCaseComponent: string | undefined) =>
  suiteComponent && testCaseComponent ? `${suiteComponent}.${testCaseComponent}` : undefined;

const parseDescription = (element: unknown): { description?: string; descriptionHtml?: string } => {
  if (typeof element === "string") {
    return { description: element };
  }

  if (!isStringAnyRecord(element)) {
    return {};
  }

  const { "#text": value, type } = element;
  const safeValue = ensureString(value);

  return ensureString(type)?.toLowerCase() === "html" ? { descriptionHtml: safeValue } : { description: safeValue };
};

const combineDescriptions = (
  suiteDescription: string | undefined,
  testDescription: string | undefined,
  sep: string,
) => {
  return [suiteDescription, testDescription].filter(Boolean).join(sep) || undefined;
};

const parseFailure = (element: unknown): { message?: string; trace?: string } => {
  if (!isStringAnyRecord(element)) {
    return {};
  }
  const { message, "stack-trace": trace } = element;
  return { message: ensureString(message), trace: ensureString(trace) };
};

const parseTime = (startElement: unknown, stopElement: unknown) => {
  const start = ensureInt(startElement);
  const stop = ensureInt(stopElement);
  const duration = stop !== undefined && start !== undefined ? Math.max(0, stop - start) : undefined;
  return { start, stop, duration };
};

const parseLabels = (labelsElement: unknown): RawTestLabel[] => {
  if (!isStringAnyRecord(labelsElement)) {
    return [];
  }

  const { label: labelElements } = labelsElement;
  if (!Array.isArray(labelElements)) {
    return [];
  }

  return labelElements.filter(isStringAnyRecord).map(convertLabel);
};

const convertLabel = (labelElement: Record<string, unknown>): RawTestLabel => {
  const { name, value } = labelElement;
  return {
    name: ensureString(name),
    value: ensureString(value),
  };
};

const labelExists = (labels: readonly RawTestLabel[], name: string) => labels.some((l) => l.name === name);
const findAllLabels = (labels: readonly RawTestLabel[], name: string) => labels.filter((l) => l.name === name);
const maybeFindLabelValue = (labels: readonly RawTestLabel[], name: string) =>
  labels.find((l) => l.name === name)?.value;

const labelValueExistsIgnoreCase = (labels: readonly RawTestLabel[], value: string) =>
  labels.some((l) => l.value?.toLowerCase() === value);

const createLinks = (labels: readonly RawTestLabel[], labelName: string, linkType: string): RawTestLink[] =>
  findAllLabels(labels, labelName).map(({ value }) => ({ name: value, url: value, type: linkType }));

const resolveTestClass = (
  testCaseLabels: RawTestLabel[],
  suiteLabels: readonly RawTestLabel[],
  suiteName: string | undefined,
  suiteTitle: string | undefined,
) =>
  maybeFindLabelValue(testCaseLabels, TEST_CLASS_LABEL_NAME) ??
  maybeFindLabelValue(suiteLabels, TEST_CLASS_LABEL_NAME) ??
  suiteName ??
  suiteTitle;

const resolveTestMethod = (testCaseLabels: RawTestLabel[], name: string | undefined, title: string | undefined) =>
  maybeFindLabelValue(testCaseLabels, TEST_METHOD_LABEL_NAME) ?? name ?? title;

const composeTestResultLabels = (
  allLabels: RawTestLabel[],
  testClass: string | undefined,
  testMethod: string | undefined,
  suite: string | undefined,
) => {
  const labels = allLabels.filter(({ name: labelName }) => !labelName || !RESERVER_LABEL_NAMES.has(labelName));
  addLabel(labels, TEST_CLASS_LABEL_NAME, testClass);
  addLabel(labels, TEST_METHOD_LABEL_NAME, testMethod);
  addLabelIfNotExists(labels, SUITE_LABEL_NAME, suite);
  return labels;
};

const addLabelIfNotExists = (labels: RawTestLabel[], name: string, value: string | undefined) => {
  if (!labelExists(labels, name)) {
    addLabel(labels, name, value);
  }
};

const addLabel = (labels: RawTestLabel[], name: string, value: string | undefined) => {
  if (value) {
    labels.push({ name, value });
  }
};

const parseSteps = (element: unknown): RawTestStepResult[] | undefined => {
  if (!isStringAnyRecord(element)) {
    return undefined;
  }

  const { step: stepElement } = element;
  if (!isStringAnyRecordArray(stepElement)) {
    return undefined;
  }

  return stepElement.map((step) => {
    const {
      name,
      title,
      status,
      start: startElement,
      stop: stopElement,
      steps: stepsElement,
      attachments: attachmentsElement,
    } = step;
    const { start, stop, duration } = parseTime(startElement, stopElement);
    const steps = [...(parseSteps(stepsElement) ?? []), ...(parseAttachments(attachmentsElement) ?? [])];

    return {
      name: ensureString(title) ?? ensureString(name) ?? DEFAULT_STEP_NAME,
      status: convertStatus(ensureString(status)),
      start,
      stop,
      duration,
      steps,
      type: "step",
    };
  });
};

const parseAttachments = (element: unknown): RawTestAttachment[] | undefined => {
  if (!isStringAnyRecord(element)) {
    return undefined;
  }

  const { attachment: attachmentElement } = element;
  if (!isStringAnyRecordArray(attachmentElement)) {
    return undefined;
  }

  return attachmentElement.map((attachment: Record<any, string>) => {
    const { title, source, type } = attachment;
    return {
      type: "attachment",
      name: ensureString(title),
      originalFileName: ensureString(source),
      contentType: ensureString(type),
    };
  });
};

const parseParameters = (element: unknown): RawTestParameter[] | undefined => {
  if (!isStringAnyRecord(element)) {
    return undefined;
  }

  const { parameter } = element;
  if (!isStringAnyRecordArray(parameter)) {
    return undefined;
  }

  return parameter
    .filter((p) => {
      const { kind } = p;
      if (!kind) {
        return true;
      }

      const kindString = ensureString(kind);
      return kindString?.toLowerCase() === "argument";
    })
    .map((p) => {
      const { name, value } = p;
      return { name: ensureString(name), value: ensureString(value) };
    });
};

const convertStatus = (status: string | undefined): RawTestStatus => {
  switch (status?.toLowerCase() ?? "unknown") {
    case "failed":
      return "failed";
    case "broken":
      return "broken";
    case "passed":
      return "passed";
    case "skipped":
    case "canceled":
    case "pending":
      return "skipped";
    default:
      return "unknown";
  }
};
