import type {
  RawStep,
  RawTestAttachment,
  RawTestLabel,
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

const DEFAULT_STEP_NAME = "The step's name is not defined";

const arrayTags: Set<string> = new Set([
  "test-suite.labels.label",
  "test-suite.test-cases.test-case",
  "test-suite.test-cases.test-case.labels.label",
  "test-suite.test-cases.test-case.steps.step",
  "test-suite.test-cases.test-case.attachments.attachment",
  "test-suite.test-cases.test-case.parameters.parameter",
  "test-suite.test-cases.test-case.steps.step.attachments.attachment",
]);

const xmlParser = new XMLParser({
  parseTagValue: false,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  allowBooleanAttributes: true,
  isArray: (tagName, jPath) => arrayTags.has(jPath),
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
  const { "name": testSuiteName, "test-cases": testCases, "labels": labelsElement } = testSuite;
  if (!isStringAnyRecord(testCases)) {
    return false;
  }

  const { "test-case": testCase } = testCases;

  if (!isStringAnyRecordArray(testCase)) {
    return false;
  }

  const labels = parseLabels(labelsElement);

  for (const tc of testCase) {
    await parseTestCase(visitor, { name: ensureString(testSuiteName), labels }, tc);
  }
  return true;
};

const parseTestCase = async (
  visitor: ResultsVisitor,
  testSuite: { name?: string; labels: readonly RawTestLabel[] },
  testCase: Record<string, any>,
) => {
  const { labels: suiteLabels } = testSuite;
  const {
    name: nameElement,
    status: statusElement,
    failure: failureElement,
    parameters: parametersElement,
    steps: stepsElement,
    start: startElement,
    stop: stopElement,
    attachments: attachmentsElement,
    labels: labelsElement,
  } = testCase;

  const name = ensureString(nameElement);
  const status = convertStatus(ensureString(statusElement));
  const { start, stop, duration } = parseTime(startElement, stopElement);
  const labels = [...suiteLabels, ...parseLabels(labelsElement)];

  const { message, trace } = parseFailure(failureElement);
  const parameters = parseParameters(parametersElement);
  const steps: RawStep[] = [...(parseSteps(stepsElement) ?? []), ...(parseAttachments(attachmentsElement) ?? [])];

  await visitor.visitTestResult(
    { name, status, start, stop, duration, message, trace, labels, parameters, steps },
    { readerId },
  );
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
