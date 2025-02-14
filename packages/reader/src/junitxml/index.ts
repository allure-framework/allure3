import type { ResultFile } from "@allurereport/plugin-api";
import type { RawTestAttachment, RawTestLabel, RawTestStatus, ResultsVisitor } from "@allurereport/reader-api";
import { BufferResultFile, FileResultsReader } from "@allurereport/reader-api";
import { XMLParser } from "fast-xml-parser";
import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { ensureString } from "../utils.js";
import { isEmptyElement, isStringAnyRecord, isStringAnyRecordArray } from "../xml-utils.js";

const MS_IN_S = 1_000;

const DEFAULT_TEST_NAME = "The test's name is not defined";

const STDOUT_ATTACHMENT_NAME = "System output";
const STDERR_ATTACHMENT_NAME = "System error";

const SUITE_PACKAGE_NAME = "package";
const SUITE_PARENT_LABEL_NAME = "parentSuite";
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

class JunitXmlReader extends FileResultsReader {
  constructor() {
    super("junit");
  }

  override async readFile(visitor: ResultsVisitor, data: ResultFile) {
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

        return await this.#parseRootElement(visitor, parsed);
      } catch (e) {
        console.error("error parsing", data.getOriginalFileName(), e);
        return false;
      }
    }
    return false;
  }

  #parseRootElement = async (visitor: ResultsVisitor, xml: Record<string, any>): Promise<boolean> => {
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
        await this.#parseTestSuite(visitor, testSuitesArrayElement, true);
      }
      return true;
    }

    if (!isStringAnyRecord(testSuite)) {
      return false;
    }

    await this.#parseTestSuite(visitor, testSuite, false);
    return true;
  };

  #parseTestSuite = async (visitor: ResultsVisitor, testSuite: Record<string, any>, isAggregated: boolean) => {
    const { name, package: packageAttribute, testcase } = testSuite;

    if (!isStringAnyRecordArray(testcase)) {
      return;
    }

    for (const testcaseElement of testcase) {
      await this.#parseTestCase(
        visitor,
        { name: ensureString(name), suitePackage: ensureString(packageAttribute) },
        testcaseElement,
        isAggregated,
      );
    }
  };

  #parseTestCase = async (
    visitor: ResultsVisitor,
    { name: suiteName, suitePackage }: { name?: string; suitePackage?: string },
    testCase: Record<string, any>,
    isAggregated: boolean,
  ) => {
    const {
      "name": nameAttribute,
      failure,
      error,
      skipped,
      "classname": classNameAttribute,
      time,
      "system-out": systemOutAttribute,
      "system-err": systemErrAttribute,
    } = testCase;

    const name = ensureString(nameAttribute);
    const className = ensureString(classNameAttribute);
    const systemOut = ensureString(systemOutAttribute);
    const systemErr = ensureString(systemErrAttribute);

    const { status, message, trace } = this.#getStatus(failure, error, skipped);

    await visitor.visitTestResult(
      {
        name: name ?? DEFAULT_TEST_NAME,
        fullName: this.#convertFullName(className, name),
        duration: this.#convertDuration(time),
        status,
        message,
        trace,
        steps: await this.#parseAttachments(visitor, systemOut, systemErr),
        labels: this.#convertLabels({ suitePackage, suiteName, className, isAggregated }),
      },
      { readerId },
    );
  };

  #convertFullName = (className?: string, name?: string) => (className && name ? `${className}.${name}` : undefined);

  #parseAttachments = async (visitor: ResultsVisitor, systemOut?: string, systemErr?: string) => {
    const attachments: RawTestAttachment[] = [];

    if (systemOut) {
      attachments.push(await this.#visitPlainTextAttachment(visitor, STDOUT_ATTACHMENT_NAME, systemOut));
    }

    if (systemErr) {
      attachments.push(await this.#visitPlainTextAttachment(visitor, STDERR_ATTACHMENT_NAME, systemErr));
    }

    return attachments;
  };

  #visitPlainTextAttachment = async (
    visitor: ResultsVisitor,
    name: string,
    content: string,
  ): Promise<RawTestAttachment> => {
    const fileName = randomUUID();
    await visitor.visitAttachmentFile(new BufferResultFile(Buffer.from(content), fileName), { readerId });
    return {
      type: "attachment",
      contentType: "text/plain",
      originalFileName: fileName,
      name,
    };
  };

  #convertLabels = ({
    suitePackage,
    suiteName,
    className,
    isAggregated,
  }: {
    suitePackage: string | undefined;
    suiteName: string | undefined;
    className: string | undefined;
    isAggregated: boolean;
  }) => {
    const labels: RawTestLabel[] = [];

    if (suitePackage) {
      labels.push({ name: SUITE_PACKAGE_NAME, value: suitePackage });
      if (isAggregated) {
        labels.push({ name: SUITE_PARENT_LABEL_NAME, value: suitePackage });
      }
    }

    if (suiteName) {
      labels.push({ name: SUITE_LABEL_NAME, value: suiteName });
    }

    if (className) {
      labels.push({ name: TEST_CLASS_LABEL_NAME, value: className });
    }

    return labels;
  };

  #convertDuration = (timeAttribute: unknown) => {
    const time = ensureString(timeAttribute);
    return time ? Math.round(parseFloat(time) * MS_IN_S) : undefined;
  };

  #getStatus = (failure: unknown, error: unknown, skipped: unknown) =>
    this.#maybeParseStatus("failed", failure) ??
    this.#maybeParseStatus("broken", error) ??
    this.#maybeParseStatus("skipped", skipped) ?? { status: "passed" };

  #maybeParseStatus = (
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
}

export const junitXml = new JunitXmlReader();
