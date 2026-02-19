import { notNull } from "@allurereport/core-api";
import type {
  RawFixtureResult,
  RawStep,
  RawTestAttachment,
  RawTestLabel,
  RawTestLink,
  RawTestParameter,
  RawTestResult,
  RawTestStatus,
  ResultsReader,
  ResultsVisitor,
} from "@allurereport/reader-api";
import { XMLParser } from "fast-xml-parser";
import * as console from "node:console";
import { randomUUID } from "node:crypto";
import type { Category, ExecutorInfo } from "../model.js";
import { parseProperties } from "../properties.js";
import { ensureBoolean, ensureInt, ensureString } from "../utils.js";
import { cleanBadXmlCharacters, isStringAnyRecord, isStringAnyRecordArray } from "../xml-utils.js";
import type {
  Attachment,
  FixtureResult,
  Globals,
  Label,
  Link,
  Parameter,
  Status,
  StepResult,
  TestResult,
  TestResultContainer,
} from "./model.js";
import { ParameterMode } from "./model.js";

const arrayTags: Set<string> = new Set(["environment.parameter"]);

const xmlParser = new XMLParser({
  parseTagValue: false,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  allowBooleanAttributes: true,
  processEntities: false,
  isArray: (tagName, jPath) => arrayTags.has(jPath),
});

const readerId = "allure2";

export const allure2: ResultsReader = {
  read: async (visitor, data) => {
    const originalFileName = data.getOriginalFileName();

    // this is essential in case we need to attach valid result files
    // e.g. like in allure2.test.ts
    if (originalFileName.match(/-attachment(?:\..+)?/)) {
      await visitor.visitAttachmentFile(data, { readerId });
      return true;
    }

    if (originalFileName.endsWith("-result.json")) {
      try {
        const parsed = await data.asJson<unknown>();

        if (parsed && isStringAnyRecord(parsed)) {
          await processTestResult(visitor, parsed, originalFileName);
        }

        return true;
      } catch (e) {
        console.error("error parsing", originalFileName, e);
        return false;
      }
    }

    if (originalFileName.endsWith("-container.json")) {
      const parsed = await data.asJson<Partial<TestResultContainer>>();

      if (parsed) {
        await processTestResultContainer(visitor, parsed);
      }

      return true;
    }

    if (originalFileName.endsWith("-globals.json")) {
      const parsed = await data.asJson<Globals>();

      if (parsed) {
        await processGlobals(visitor, parsed);
      }

      return true;
    }

    if (originalFileName === "executor.json") {
      try {
        const parsed = await data.asJson<unknown>();
        if (parsed && isStringAnyRecord(parsed)) {
          await processExecutor(visitor, parsed);
        }
        return true;
      } catch (e) {
        console.error("error parsing", originalFileName, e);
        return false;
      }
    }

    if (originalFileName === "categories.json") {
      try {
        const parsed = await data.asJson<unknown>();
        if (parsed && isStringAnyRecordArray(parsed)) {
          await processCategories(visitor, parsed);
        }
        return true;
      } catch (e) {
        console.error("error parsing", originalFileName, e);
        return false;
      }
    }

    if (originalFileName === "environment.properties") {
      try {
        const raw = await data.asUtf8String();
        if (raw) {
          const parsed = parseProperties(raw);
          if (parsed && isStringAnyRecord(parsed)) {
            await processEnvironment(visitor, parsed);
          }
        }
        return true;
      } catch (e) {
        console.error("error parsing", originalFileName, e);
        return false;
      }
    }

    if (originalFileName === "environment.xml") {
      try {
        const asBuffer = await data.asBuffer();
        if (!asBuffer) {
          return false;
        }
        const content = cleanBadXmlCharacters(asBuffer).toString("utf-8");
        const parsed = xmlParser.parse(content);
        if (isStringAnyRecord(parsed)) {
          await processEnvironmentXml(visitor, parsed);
        }
        return true;
      } catch (e) {
        console.error("error parsing", originalFileName, e);
        return false;
      }
    }

    return false;
  },

  readerId: () => readerId,
};

const processTestResult = async (visitor: ResultsVisitor, result: Partial<TestResult>, originalFileName: string) => {
  const dest: RawTestResult = {
    uuid: ensureString(result.uuid),
    titlePath: result?.titlePath?.length ? result.titlePath : [],
    fullName: ensureString(result.fullName),
    name: ensureString(result.name),
    testId: ensureString(result.testCaseId),
    historyId: ensureString(result.historyId),

    start: ensureInt(result.start),
    stop: ensureInt(result.stop),

    description: ensureString(result.description),
    descriptionHtml: ensureString(result.descriptionHtml),

    status: convertStatus(result.status),
    message: ensureString(result?.statusDetails?.message),
    trace: ensureString(result?.statusDetails?.trace),
    actual: ensureString(result?.statusDetails?.actual, ""),
    expected: ensureString(result?.statusDetails?.expected, ""),
    flaky: ensureBoolean(result?.statusDetails?.flaky),
    known: ensureBoolean(result?.statusDetails?.known),
    muted: ensureBoolean(result?.statusDetails?.muted),

    parameters: result?.parameters?.filter(notNull)?.map(convertParameter),
    steps: [
      ...(result?.steps?.filter(notNull)?.map(convertStep) ?? []),
      ...(result?.attachments?.filter(notNull)?.map(convertAttachment) ?? []),
    ],
    links: result?.links?.filter(notNull)?.map(convertLink),
    labels: result.labels?.filter(notNull)?.map(convertLabel),
  };

  await visitor.visitTestResult(dest, { readerId, metadata: { originalFileName } });
};

const processExecutor = async (visitor: ResultsVisitor, result: Partial<ExecutorInfo>) => {
  await visitor.visitMetadata(
    {
      allure2_executor: {
        name: ensureString(result.name),
        type: ensureString(result.type),
        url: ensureString(result.url),
        buildOrder: ensureInt(result.buildOrder),
        buildName: ensureString(result.buildName),
        buildUrl: ensureString(result.buildUrl),
        reportName: ensureString(result.reportName),
        reportUrl: ensureString(result.reportUrl),
      },
    },
    { readerId },
  );
};

const processCategories = async (visitor: ResultsVisitor, result: Partial<Category>[]) => {
  const data = result.map((value) => ({
    name: ensureString(value.name),
    description: ensureString(value.description),
    descriptionHtml: ensureString(value.descriptionHtml),
    messageRegex: ensureString(value.messageRegex),
    traceRegex: ensureString(value.traceRegex),
    matchedStatuses: Array.isArray(value.matchedStatuses)
      ? value.matchedStatuses.map((v) => ensureString(v)).filter(notNull)
      : [],
    flaky: ensureBoolean(value.flaky),
  }));

  await visitor.visitMetadata(
    {
      allure2_categories: data,
    },
    { readerId },
  );
};

const processEnvironmentXml = async (visitor: ResultsVisitor, result: Record<string, any>) => {
  const { environment } = result;
  if (!isStringAnyRecord(environment)) {
    return;
  }
  const { parameter: parameters } = environment;
  if (!isStringAnyRecordArray(parameters)) {
    return;
  }
  const data: { name: string; values: string[] }[] = [];
  parameters.forEach((param) => {
    const { key, value } = param;
    const stringKey = ensureString(key);
    const stringValue = ensureString(value);
    if (stringKey && stringValue) {
      data.push({ name: stringKey, values: [stringValue] });
    }
  });

  await visitor.visitMetadata(
    {
      allure_environment: data,
    },
    {
      readerId,
    },
  );
};

const processEnvironment = async (visitor: ResultsVisitor, result: Record<string, any>) => {
  const data = Object.keys(result).map((key: string) => {
    const rawValue = result[key];
    const value = typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue);
    return {
      name: key,
      values: [value],
    };
  });

  await visitor.visitMetadata(
    {
      allure_environment: data,
    },
    {
      readerId,
    },
  );
};

const processFixtures = async (
  visitor: ResultsVisitor,
  fixtures: FixtureResult[] | undefined,
  type: RawFixtureResult["type"],
  children: string[],
) => {
  if (fixtures) {
    for (const fixture of fixtures) {
      const dist = convertFixture(type, children, fixture);
      await visitor.visitTestFixtureResult(dist, { readerId });
    }
  }
};

const processTestResultContainer = async (visitor: ResultsVisitor, result: Partial<TestResultContainer>) => {
  if (result.children && result.children.length > 0) {
    await processFixtures(visitor, result.befores, "before", result.children);
    await processFixtures(visitor, result.afters, "after", result.children);
  }
};

const processGlobals = async (visitor: ResultsVisitor, globals: Globals) => {
  const { attachments = [], errors = [] } = globals;

  await visitor.visitGlobals(
    {
      attachments: Array.isArray(attachments) ? attachments.map((attachment) => convertAttachment(attachment)) : [],
      errors: isStringAnyRecordArray(errors) ? errors : [],
    },
    { readerId },
  );
};

const convertStatus = (status: Status | string | null | undefined): RawTestStatus => {
  switch ((status ?? "unknown").toLowerCase()) {
    case "failed":
      return "failed";
    case "broken":
      return "broken";
    case "passed":
      return "passed";
    case "skipped":
      return "skipped";
    default:
      return "unknown";
  }
};

const convertFixture = (type: "before" | "after", children: string[], fixture: FixtureResult): RawFixtureResult => {
  return {
    uuid: randomUUID(),
    testResults: children,
    type,
    name: fixture.name,
    start: ensureInt(fixture.start),
    stop: ensureInt(fixture.stop),
    status: convertStatus(fixture.status),
    message: ensureString(fixture?.statusDetails?.message),
    trace: ensureString(fixture?.statusDetails?.trace),
    steps: [
      ...(fixture?.steps?.filter(notNull)?.map(convertStep) ?? []),
      ...(fixture?.attachments?.filter(notNull)?.map(convertAttachment) ?? []),
    ],
  };
};

const convertStep = (step: StepResult): RawStep => {
  const steps = step?.steps ?? [];
  const attachments = step?.attachments ?? [];

  // support for attachment meta steps https://github.com/allure-framework/allure2/pull/2107
  if (steps.length === 0 && attachments.length === 1 && step.name === attachments[0].name) {
    return {
      ...convertAttachment(attachments[0]),
      start: step.start,
      stop: step.stop,
    };
  }

  return {
    name: ensureString(step.name),
    parameters: step?.parameters?.filter(notNull)?.map(convertParameter),
    status: convertStatus(step.status),
    message: ensureString(step?.statusDetails?.message),
    trace: ensureString(step?.statusDetails?.trace),
    steps: [
      ...(steps.filter(notNull)?.map(convertStep) ?? []),
      ...(attachments.filter(notNull)?.map(convertAttachment) ?? []),
    ],
    start: ensureInt(step.start),
    stop: ensureInt(step.stop),
    type: "step",
  };
};

const convertParameter = ({ mode, name, value, excluded }: Parameter): RawTestParameter => {
  return {
    name: ensureString(name),
    value: ensureString(value),
    excluded: ensureBoolean(excluded),
    hidden: mode === ParameterMode.HIDDEN,
    masked: mode === ParameterMode.MASKED,
  };
};

const convertAttachment = ({ name, type, source }: Attachment): RawTestAttachment => {
  return {
    name: ensureString(name),
    contentType: ensureString(type),
    originalFileName: ensureString(source),
    type: "attachment",
  };
};

const convertLabel = ({ name, value }: Label): RawTestLabel => {
  return {
    name: ensureString(name),
    value: ensureString(value),
  };
};

const convertLink = ({ name, url, type }: Link): RawTestLink => {
  return {
    name: ensureString(name),
    url: ensureString(url),
    type: ensureString(type),
  };
};
