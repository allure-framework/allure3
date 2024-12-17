import type {
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

const arrayTags: Set<string> = new Set([
  "test-suite.test-cases.test-case",
  "test-suite.test-cases.test-case.steps.step",
  "test-suite.test-cases.test-case.attachments.attachment",
  "test-suite.test-cases.test-case.labels",
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
  const { name: testSuiteName, "test-cases": testCases } = testSuite;
  if (!isStringAnyRecord(testCases)) {
    return false;
  }

  const { "test-case": testCase } = testCases;

  if (!isStringAnyRecordArray(testCase)) {
    return false;
  }

  for (const tc of testCase) {
    await parseTestCase(visitor, { name: ensureString(testSuiteName) }, tc);
  }
  return true;
};

const parseTestCase = async (visitor: ResultsVisitor, testSuite: { name?: string }, testCase: Record<string, any>) => {
  const {
    name: nameElement,
    status: statusElement,
    failure: failureElement,
    parameters: parametersElement,
    steps: stepsElement,
    start: startElement,
    stop: stopElement,
  } = testCase;

  const name = ensureString(nameElement);
  const status = convertStatus(ensureString(statusElement));
  const { start, stop, duration } = parseTime(startElement, stopElement);

  const { message, trace } = parseFailure(failureElement);
  const parameters = parseParameters(parametersElement);
  const steps = parseSteps(stepsElement);

  await visitor.visitTestResult(
    { name, status, start, stop, duration, message, trace, parameters, steps },
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

const parseSteps = (element: unknown): RawTestStepResult[] | undefined => {
  if (!isStringAnyRecord(element)) {
    return undefined;
  }

  const { step: stepElement } = element;
  if (!isStringAnyRecordArray(stepElement)) {
    return undefined;
  }

  return stepElement.map((step) => {
    const { name, title, status, start: startElement, stop: stopElement, steps: stepsElement } = step;
    const { start, stop, duration } = parseTime(startElement, stopElement);
    const steps = parseSteps(stepsElement);

    return {
      name: ensureString(title) ?? ensureString(name),
      status: convertStatus(ensureString(status)),
      start,
      stop,
      duration,
      steps,
      type: "step",
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
