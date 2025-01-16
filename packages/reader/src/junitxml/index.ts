import type {
  RawTestAttachment,
  RawTestLabel,
  RawTestStatus,
  ResultsReader,
  ResultsVisitor,
} from "@allurereport/reader-api";
import { BufferResultFile } from "@allurereport/reader-api";
import { XMLParser } from "fast-xml-parser";
import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { ensureString } from "../utils.js";
import { isEmptyElement, isStringAnyRecord, isStringAnyRecordArray } from "../xml-utils.js";

const MS_IN_S = 1_000;

const DEFAULT_TEST_NAME = "The test's name is not defined";

const SUITE_PACKAGE_NAME = "package";
const SUITE_LABEL_NAME = "suite";
const TEST_CLASS_LABEL_NAME = "testClass";

const arrayTags: Set<string> = new Set(["testsuite.testcase", "testsuites.testsuite", "testsuites.testsuite.testcase"]);

const xmlParser = new XMLParser({
  parseTagValue: false,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  allowBooleanAttributes: true,
  isArray: (tagName, jPath) => arrayTags.has(jPath),
});

const readerId = "junit";

export const junitXml: ResultsReader = {
  read: async (visitor, data) => {
    if (data.getOriginalFileName().endsWith(".xml")) {
      try {
        const content = await data.asUtf8String();
        if (!content) {
          return false;
        }
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
  const { testsuite: testSuite } = xml;

  if (isEmptyElement(testSuite)) {
    return true;
  }

  if (testSuite === undefined) {
    const { testsuites: testSuites } = xml;

    if (isEmptyElement(testSuites)) {
      return true;
    }

    if (!isStringAnyRecord(testSuites)) {
      return false;
    }

    const { testsuite: testSuitesArray } = testSuites;

    if (isEmptyElement(testSuitesArray)) {
      return true;
    }

    if (!isStringAnyRecordArray(testSuitesArray)) {
      return false;
    }

    for (const testSuitesArrayElement of testSuitesArray) {
      await parseTestSuite(visitor, testSuitesArrayElement);
    }
    return true;
  }

  if (!isStringAnyRecord(testSuite)) {
    return false;
  }

  await parseTestSuite(visitor, testSuite);
  return true;
};

const parseTestSuite = async (visitor: ResultsVisitor, testSuite: Record<string, any>) => {
  const { name, package: packageAttribute, testcase } = testSuite;

  if (!isStringAnyRecordArray(testcase)) {
    return;
  }

  for (const testcaseElement of testcase) {
    await parseTestCase(
      visitor,
      { name: ensureString(name), suitePackage: ensureString(packageAttribute) },
      testcaseElement,
    );
  }
};

const parseTestCase = async (
  visitor: ResultsVisitor,
  { name: suiteName, suitePackage }: { name?: string; suitePackage?: string },
  testCase: Record<string, any>,
) => {
  const {
    "name": nameAttribute,
    failure,
    error,
    skipped,
    "classname": classNameAttribute,
    time,
    "system-out": systemOutAttribute,
  } = testCase;

  const name = ensureString(nameAttribute);
  const className = ensureString(classNameAttribute);
  const systemOut = ensureString(systemOutAttribute);

  const { status, message, trace } = getStatus(failure, error, skipped);

  await visitor.visitTestResult(
    {
      name: name ?? DEFAULT_TEST_NAME,
      fullName: convertFullName(className, name),
      duration: convertDuration(time),
      status,
      message,
      trace,
      steps: await parseAttachments(visitor, systemOut),
      labels: convertLabels(suitePackage, suiteName, className),
    },
    { readerId },
  );
};

const convertFullName = (className?: string, name?: string) => (className && name ? `${className}.${name}` : undefined);

const parseAttachments = async (visitor: ResultsVisitor, systemOut?: string) => {
  const attachments: RawTestAttachment[] = [];

  if (systemOut) {
    const fileName = randomUUID();
    await visitor.visitAttachmentFile(new BufferResultFile(Buffer.from(systemOut), fileName), { readerId });
    attachments.push({
      type: "attachment",
      contentType: "text/plain",
      originalFileName: fileName,
      name: "System out",
    });
  }

  return attachments;
};

const convertLabels = (suitePackage?: string, suiteName?: string, className?: string) => {
  const labels: RawTestLabel[] = [];

  if (suitePackage) {
    labels.push({ name: SUITE_PACKAGE_NAME, value: suitePackage });
  }

  if (suiteName) {
    labels.push({ name: SUITE_LABEL_NAME, value: suiteName });
  }

  if (className) {
    labels.push({ name: TEST_CLASS_LABEL_NAME, value: className });
  }

  return labels;
};

const convertDuration = (timeAttribute: unknown) => {
  const time = ensureString(timeAttribute);
  return time ? Math.round(parseFloat(time) * MS_IN_S) : undefined;
};

const getStatus = (failure: unknown, error: unknown, skipped: unknown) =>
  maybeParseStatus("failed", failure) ??
  maybeParseStatus("broken", error) ??
  maybeParseStatus("skipped", skipped) ?? { status: "passed" };

const maybeParseStatus = (
  status: RawTestStatus,
  element: unknown,
): { status: RawTestStatus; message?: string; trace?: string } | undefined => {
  if (isEmptyElement(element)) {
    return { status };
  }

  if (isStringAnyRecord(element)) {
    const { message, "#text": trace } = element;
    return { status, message: ensureString(message), trace: ensureString(trace) };
  }
};
