import { notNull } from "@allurereport/core-api";
import type { ResultFile } from "@allurereport/plugin-api";
import type {
  RawFixtureResult,
  RawStep,
  RawTestAttachment,
  RawTestLabel,
  RawTestLink,
  RawTestParameter,
  RawTestResult,
  RawTestStatus,
  ResultsVisitor,
} from "@allurereport/reader-api";
import { FileResultsReader } from "@allurereport/reader-api";
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
  isArray: (tagName, jPath) => arrayTags.has(jPath),
});

class Allure2Reader extends FileResultsReader {
  constructor() {
    super("allure2");
  }

  override async readFile(visitor: ResultsVisitor, data: ResultFile) {
    // this is essential in case we need to attach valid result files
    // e.g. like in allure2.test.ts
    if (data.getOriginalFileName().match(/-attachment(?:\..+)?/)) {
      await visitor.visitAttachmentFile(data, { readerId: this.readerId() });
      return true;
    }
    if (data.getOriginalFileName().endsWith("-result.json")) {
      try {
        const parsed = await data.asJson<unknown>();

        if (parsed && isStringAnyRecord(parsed)) {
          await this.#processTestResult(visitor, parsed, data.getOriginalFileName());
        }

        return true;
      } catch (e) {
        console.error("error parsing", data.getOriginalFileName(), e);
        return false;
      }
    }

    if (data.getOriginalFileName().endsWith("-container.json")) {
      const parsed = await data.asJson<Partial<TestResultContainer>>();

      if (parsed) {
        await this.#processTestResultContainer(visitor, parsed);
      }

      return true;
    }

    if (data.getOriginalFileName() === "executor.json") {
      try {
        const parsed = await data.asJson<unknown>();
        if (parsed && isStringAnyRecord(parsed)) {
          await this.#processExecutor(visitor, parsed);
        }
        return true;
      } catch (e) {
        console.error("error parsing", data.getOriginalFileName(), e);
        return false;
      }
    }

    if (data.getOriginalFileName() === "categories.json") {
      try {
        const parsed = await data.asJson<unknown>();
        if (parsed && isStringAnyRecordArray(parsed)) {
          await this.#processCategories(visitor, parsed);
        }
        return true;
      } catch (e) {
        console.error("error parsing", data.getOriginalFileName(), e);
        return false;
      }
    }

    if (data.getOriginalFileName() === "environment.properties") {
      try {
        const raw = await data.asUtf8String();
        if (raw) {
          const parsed = parseProperties(raw);
          if (parsed && isStringAnyRecord(parsed)) {
            await this.#processEnvironment(visitor, parsed);
          }
        }
        return true;
      } catch (e) {
        console.error("error parsing", data.getOriginalFileName(), e);
        return false;
      }
    }

    if (data.getOriginalFileName() === "environment.xml") {
      try {
        const asBuffer = await data.asBuffer();
        if (!asBuffer) {
          return false;
        }
        const content = cleanBadXmlCharacters(asBuffer).toString("utf-8");
        const parsed = xmlParser.parse(content);
        if (isStringAnyRecord(parsed)) {
          await this.#processEnvironmentXml(visitor, parsed);
        }
        return true;
      } catch (e) {
        console.error("error parsing", data.getOriginalFileName(), e);
        return false;
      }
    }

    return false;
  }

  #processTestResult = async (visitor: ResultsVisitor, result: Partial<TestResult>, originalFileName: string) => {
    const dest: RawTestResult = {
      uuid: ensureString(result.uuid),
      fullName: ensureString(result.fullName),
      name: ensureString(result.name),
      testId: ensureString(result.testCaseId),
      historyId: ensureString(result.historyId),

      start: ensureInt(result.start),
      stop: ensureInt(result.stop),

      description: ensureString(result.description),
      descriptionHtml: ensureString(result.descriptionHtml),

      status: this.#convertStatus(result.status),
      message: ensureString(result?.statusDetails?.message),
      trace: ensureString(result?.statusDetails?.trace),
      flaky: ensureBoolean(result?.statusDetails?.flaky),
      known: ensureBoolean(result?.statusDetails?.known),
      muted: ensureBoolean(result?.statusDetails?.muted),

      parameters: result?.parameters?.filter(notNull)?.map(this.#convertParameter),
      steps: [
        ...(result?.steps?.filter(notNull)?.map(this.#convertStep) ?? []),
        ...(result?.attachments?.filter(notNull)?.map(this.#convertAttachment) ?? []),
      ],
      links: result?.links?.filter(notNull)?.map(this.#convertLink),
      labels: result.labels?.filter(notNull)?.map(this.#convertLabel),
    };

    await visitor.visitTestResult(dest, { readerId: this.readerId(), metadata: { originalFileName } });
  };

  #processExecutor = async (visitor: ResultsVisitor, result: Partial<ExecutorInfo>) => {
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
      { readerId: this.readerId() },
    );
  };

  #processCategories = async (visitor: ResultsVisitor, result: Partial<Category>[]) => {
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
      { readerId: this.readerId() },
    );
  };

  #processEnvironmentXml = async (visitor: ResultsVisitor, result: Record<string, any>) => {
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
        readerId: this.readerId(),
      },
    );
  };

  #processEnvironment = async (visitor: ResultsVisitor, result: Record<string, any>) => {
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
        readerId: this.readerId(),
      },
    );
  };

  #processFixtures = async (
    visitor: ResultsVisitor,
    fixtures: FixtureResult[] | undefined,
    type: RawFixtureResult["type"],
    children: string[],
  ) => {
    if (fixtures) {
      for (const fixture of fixtures) {
        const dist = this.#convertFixture(type, children, fixture);
        await visitor.visitTestFixtureResult(dist, { readerId: this.readerId() });
      }
    }
  };

  #processTestResultContainer = async (visitor: ResultsVisitor, result: Partial<TestResultContainer>) => {
    if (result.children && result.children.length > 0) {
      await this.#processFixtures(visitor, result.befores, "before", result.children);
      await this.#processFixtures(visitor, result.afters, "after", result.children);
    }
  };

  #convertStatus = (status: Status | string | null | undefined): RawTestStatus => {
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

  #convertFixture = (type: "before" | "after", children: string[], fixture: FixtureResult): RawFixtureResult => {
    return {
      uuid: randomUUID(),
      testResults: children,
      type,
      name: fixture.name,
      start: ensureInt(fixture.start),
      stop: ensureInt(fixture.stop),
      status: this.#convertStatus(fixture.status),
      message: ensureString(fixture?.statusDetails?.message),
      trace: ensureString(fixture?.statusDetails?.trace),
      steps: [
        ...(fixture?.steps?.filter(notNull)?.map(this.#convertStep) ?? []),
        ...(fixture?.attachments?.filter(notNull)?.map(this.#convertAttachment) ?? []),
      ],
    };
  };

  #convertStep = (step: StepResult): RawStep => {
    const steps = step?.steps ?? [];
    const attachments = step?.attachments ?? [];

    // support for attachment meta steps https://github.com/allure-framework/allure2/pull/2107
    if (steps.length === 0 && attachments.length === 1 && step.name === attachments[0].name) {
      return {
        ...this.#convertAttachment(attachments[0]),
        start: step.start,
        stop: step.stop,
      };
    }

    return {
      name: ensureString(step.name),
      parameters: step?.parameters?.filter(notNull)?.map(this.#convertParameter),
      status: this.#convertStatus(step.status),
      message: ensureString(step?.statusDetails?.message),
      trace: ensureString(step?.statusDetails?.trace),
      steps: [
        ...(steps.filter(notNull)?.map(this.#convertStep) ?? []),
        ...(attachments.filter(notNull)?.map(this.#convertAttachment) ?? []),
      ],
      start: ensureInt(step.start),
      stop: ensureInt(step.stop),
      type: "step",
    };
  };

  #convertParameter = ({ mode, name, value, excluded }: Parameter): RawTestParameter => {
    return {
      name: ensureString(name),
      value: ensureString(value),
      excluded: ensureBoolean(excluded),
      hidden: mode === ParameterMode.HIDDEN,
      masked: mode === ParameterMode.MASKED,
    };
  };

  #convertAttachment = ({ name, type, source }: Attachment): RawTestAttachment => {
    return {
      name: ensureString(name),
      contentType: ensureString(type),
      originalFileName: ensureString(source),
      type: "attachment",
    };
  };

  #convertLabel = ({ name, value }: Label): RawTestLabel => {
    return {
      name: ensureString(name),
      value: ensureString(value),
    };
  };

  #convertLink = ({ name, url, type }: Link): RawTestLink => {
    return {
      name: ensureString(name),
      url: ensureString(url),
      type: ensureString(type),
    };
  };
}

export const allure2 = new Allure2Reader();
