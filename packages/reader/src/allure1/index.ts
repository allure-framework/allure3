import type { ResultFile } from "@allurereport/plugin-api";
import type {
  RawStep,
  RawTestAttachment,
  RawTestLabel,
  RawTestLink,
  RawTestParameter,
  RawTestStatus,
  RawTestStepResult,
  ResultsVisitor,
} from "@allurereport/reader-api";
import { FileResultsReader } from "@allurereport/reader-api";
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
  isArray: arrayTags.has.bind(arrayTags),
});

class Allure1Reader extends FileResultsReader {
  constructor() {
    super("allure1");
  }

  override async readFile(visitor: ResultsVisitor, data: ResultFile) {
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

        return await this.#parseRootElement(visitor, parsed);
      } catch (e) {
        console.error("error parsing", data.getOriginalFileName(), e);
        return false;
      }
    }
    return false;
  }

  #parseRootElement = async (visitor: ResultsVisitor, xml: Record<string, any>): Promise<boolean> => {
    const { "test-suite": testSuite } = xml;

    if (!isStringAnyRecord(testSuite)) {
      return false;
    }

    return await this.#parseTestSuite(visitor, testSuite);
  };

  #parseTestSuite = async (visitor: ResultsVisitor, testSuite: Record<string, any>): Promise<boolean> => {
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

    const labels = this.#parseLabels(labelsElement);

    for (const tc of testCase) {
      await this.#parseTestCase(
        visitor,
        {
          name: ensureString(testSuiteName),
          title: ensureString(testSuiteTitle),
          ...this.#parseDescription(descriptionElement),
          labels,
        },
        tc,
      );
    }
    return true;
  };

  #parseTestCase = async (visitor: ResultsVisitor, testSuite: SuiteData, testCase: Record<string, any>) => {
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
    const status = this.#convertStatus(ensureString(statusElement));

    const { description: testCaseDescription, descriptionHtml: testCaseDescriptionHtml } =
      this.#parseDescription(descriptionElement);
    const description = this.#combineDescriptions(suiteDescription, testCaseDescription, "\n\n");
    const descriptionHtml = this.#combineDescriptions(suiteDescriptionHtml, testCaseDescriptionHtml, "<br>");

    const { start, stop, duration } = this.#parseTime(startElement, stopElement);

    const testCaseLabels = this.#parseLabels(labelsElement);
    const allLabels = [...suiteLabels, ...testCaseLabels];
    const testId = this.#maybeFindLabelValue(allLabels, TEST_ID_LABEL_NAME);
    const historyId = this.#maybeFindLabelValue(allLabels, HISTORY_ID_LABEL_NAME);

    const testClass = this.#resolveTestClass(testCaseLabels, suiteLabels, suiteName, suiteTitle);
    const testMethod = this.#resolveTestMethod(testCaseLabels, testCaseName, testCaseTitle);
    const fullName = this.#getFullName(testClass, testMethod);

    const statusDetailLabels = this.#findAllLabels(allLabels, STATUS_DETAILS_LABEL_NAME);
    const flaky = this.#labelValueExistsIgnoreCase(statusDetailLabels, "flaky");
    const muted = this.#labelValueExistsIgnoreCase(statusDetailLabels, "muted");
    const known = this.#labelValueExistsIgnoreCase(statusDetailLabels, "known");

    const links = [
      ...this.#createLinks(allLabels, ISSUE_LABEL_NAME, ISSUE_LINK_TYPE),
      ...this.#createLinks(allLabels, TMS_LABEL_NAME, TMS_LINK_TYPE),
    ];
    const labels = this.#composeTestResultLabels(allLabels, testClass, testMethod, suiteTitle ?? suiteName);

    const { message, trace } = this.#parseFailure(failureElement);
    const parameters = this.#parseParameters(parametersElement);
    const steps: RawStep[] = [
      ...(this.#parseSteps(stepsElement) ?? []),
      ...(this.#parseAttachments(attachmentsElement) ?? []),
    ];

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
      { readerId: this.readerId() },
    );
  };

  #getFullName = (suiteComponent: string | undefined, testCaseComponent: string | undefined) =>
    suiteComponent && testCaseComponent ? `${suiteComponent}.${testCaseComponent}` : undefined;

  #parseDescription = (element: unknown): { description?: string; descriptionHtml?: string } => {
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

  #combineDescriptions = (suiteDescription: string | undefined, testDescription: string | undefined, sep: string) => {
    return [suiteDescription, testDescription].filter(Boolean).join(sep) || undefined;
  };

  #parseFailure = (element: unknown): { message?: string; trace?: string } => {
    if (!isStringAnyRecord(element)) {
      return {};
    }
    const { message, "stack-trace": trace } = element;
    return { message: ensureString(message), trace: ensureString(trace) };
  };

  #parseTime = (startElement: unknown, stopElement: unknown) => {
    const start = ensureInt(startElement);
    const stop = ensureInt(stopElement);
    const duration = stop !== undefined && start !== undefined ? Math.max(0, stop - start) : undefined;
    return { start, stop, duration };
  };

  #parseLabels = (labelsElement: unknown): RawTestLabel[] => {
    if (!isStringAnyRecord(labelsElement)) {
      return [];
    }

    const { label: labelElements } = labelsElement;
    if (!Array.isArray(labelElements)) {
      return [];
    }

    return labelElements.filter(isStringAnyRecord).map(this.#convertLabel);
  };

  #convertLabel = (labelElement: Record<string, unknown>): RawTestLabel => {
    const { name, value } = labelElement;
    return {
      name: ensureString(name),
      value: ensureString(value),
    };
  };

  #labelExists = (labels: readonly RawTestLabel[], name: string) => labels.some((l) => l.name === name);
  #findAllLabels = (labels: readonly RawTestLabel[], name: string) => labels.filter((l) => l.name === name);
  #maybeFindLabelValue = (labels: readonly RawTestLabel[], name: string) => labels.find((l) => l.name === name)?.value;

  #labelValueExistsIgnoreCase = (labels: readonly RawTestLabel[], value: string) =>
    labels.some((l) => l.value?.toLowerCase() === value);

  #createLinks = (labels: readonly RawTestLabel[], labelName: string, linkType: string): RawTestLink[] =>
    this.#findAllLabels(labels, labelName).map(({ value }) => ({ name: value, url: value, type: linkType }));

  #resolveTestClass = (
    testCaseLabels: RawTestLabel[],
    suiteLabels: readonly RawTestLabel[],
    suiteName: string | undefined,
    suiteTitle: string | undefined,
  ) =>
    this.#maybeFindLabelValue(testCaseLabels, TEST_CLASS_LABEL_NAME) ??
    this.#maybeFindLabelValue(suiteLabels, TEST_CLASS_LABEL_NAME) ??
    suiteName ??
    suiteTitle;

  #resolveTestMethod = (testCaseLabels: RawTestLabel[], name: string | undefined, title: string | undefined) =>
    this.#maybeFindLabelValue(testCaseLabels, TEST_METHOD_LABEL_NAME) ?? name ?? title;

  #composeTestResultLabels = (
    allLabels: RawTestLabel[],
    testClass: string | undefined,
    testMethod: string | undefined,
    suite: string | undefined,
  ) => {
    const labels = allLabels.filter(({ name: labelName }) => !labelName || !RESERVER_LABEL_NAMES.has(labelName));
    this.#addLabel(labels, TEST_CLASS_LABEL_NAME, testClass);
    this.#addLabel(labels, TEST_METHOD_LABEL_NAME, testMethod);
    this.#addLabelIfNotExists(labels, SUITE_LABEL_NAME, suite);
    return labels;
  };

  #addLabelIfNotExists = (labels: RawTestLabel[], name: string, value: string | undefined) => {
    if (!this.#labelExists(labels, name)) {
      this.#addLabel(labels, name, value);
    }
  };

  #addLabel = (labels: RawTestLabel[], name: string, value: string | undefined) => {
    if (value) {
      labels.push({ name, value });
    }
  };

  #parseSteps = (element: unknown): RawTestStepResult[] | undefined => {
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
      const { start, stop, duration } = this.#parseTime(startElement, stopElement);
      const steps = [...(this.#parseSteps(stepsElement) ?? []), ...(this.#parseAttachments(attachmentsElement) ?? [])];

      return {
        name: ensureString(title) ?? ensureString(name) ?? DEFAULT_STEP_NAME,
        status: this.#convertStatus(ensureString(status)),
        start,
        stop,
        duration,
        steps,
        type: "step",
      };
    });
  };

  #parseAttachments = (element: unknown): RawTestAttachment[] | undefined => {
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

  #parseParameters = (element: unknown): RawTestParameter[] | undefined => {
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

  #convertStatus = (status: string | undefined): RawTestStatus => {
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
}

export const allure1 = new Allure1Reader();
