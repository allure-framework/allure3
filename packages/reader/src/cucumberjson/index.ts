import type { ResultFile } from "@allurereport/plugin-api";
import type {
  RawTestAttachment,
  RawTestLabel,
  RawTestResult,
  RawTestStatus,
  RawTestStepResult,
  ResultsVisitor,
} from "@allurereport/reader-api";
import { BufferResultFile, FileResultsReader } from "@allurereport/reader-api";
import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { ensureArray, ensureInt, ensureString, isArray, isNonNullObject, isString } from "../utils.js";
import type {
  CucumberDatatableRow,
  CucumberDocString,
  CucumberEmbedding,
  CucumberFeature,
  CucumberFeatureElement,
  CucumberJsStepArgument,
  CucumberStep,
  CucumberTag,
} from "./model.js";
import { STEP_NAME_PLACEHOLDER, TEST_NAME_PLACEHOLDER } from "./model.js";

const NS_IN_MS = 1_000_000;

const readerId = "cucumberjson";

const allureStepStatusPriorityOrder = {
  failed: 0,
  broken: 1,
  unknown: 2,
  skipped: 3,
  passed: 4,
};

const cucumberStatusToAllureStatus: Record<string, RawTestStatus> = {
  unknown: "unknown",
  passed: "passed",
  skipped: "skipped",
  pending: "skipped",
  ["undefined"]: "broken",
  ambiguous: "broken",
  failed: "failed",
};

// The interpretation follows https://github.com/cucumber/messages/blob/2e33e6839bf3200eec1a5a7ec6dcb26d46dab410/elixir/messages.proto#L621
const allureStepMessages: Record<string, string> = {
  unknown: "The result of the step is unknown",
  passed: "The step passed",
  skipped: "The step was skipped because the previous step hadn't passed",
  pending: "The step signalled pending during execution",
  ["undefined"]: "The step didn't match any definition",
  ambiguous: "The step matched more than one definition",
  failed: "The step failed",
};

type PreProcessedFeature = {
  name: string | undefined;
  uri: string | undefined;
  id: string | undefined;
  tags: string[];
};

type PreProcessedScenario = {
  id: string | undefined;
  name: string | undefined;
  description: string | undefined;
  tags: string[];
  type: string | undefined;
};

type PreProcessedStep = {
  keyword?: string;
  name?: string;
  status: string;
  duration?: number;
  errorMessage?: string;
  attachments: RawTestAttachment[];
};

type PostProcessedStep = { preProcessedStep: PreProcessedStep; allureStep: RawTestStepResult };

class CucumberJsonReader extends FileResultsReader {
  constructor() {
    super("cucumberjson");
  }

  override async readFile(visitor: ResultsVisitor, data: ResultFile) {
    const originalFileName = data.getOriginalFileName();
    if (originalFileName.endsWith(".json")) {
      try {
        const parsed = await data.asJson<CucumberFeature[]>();
        if (parsed) {
          let oneOrMoreFeaturesParsed = false;
          for (const feature of parsed) {
            oneOrMoreFeaturesParsed ||= await this.#processFeature(visitor, originalFileName, feature);
          }
          return oneOrMoreFeaturesParsed;
        }
      } catch (e) {
        console.error("error parsing", originalFileName, e);
        return false;
      }
    }
    return false;
  }

  #processFeature = async (visitor: ResultsVisitor, originalFileName: string, feature: CucumberFeature) => {
    if (this.#isCucumberFeature(feature)) {
      const preProcessedFeature = this.#preProcessFeature(feature);
      for (const scenario of feature.elements) {
        await this.#processScenario(visitor, originalFileName, preProcessedFeature, scenario);
      }
      return true;
    }
    return false;
  };

  #processScenario = async (
    visitor: ResultsVisitor,
    originalFileName: string,
    feature: PreProcessedFeature,
    scenario: CucumberFeatureElement,
  ) => {
    const preProcessedScenario = this.#preProcessScenario(scenario);
    if (this.#shouldProcessScenario(preProcessedScenario)) {
      const preProcessedSteps = await this.#preProcessSteps(visitor, scenario.steps ?? []);
      await visitor.visitTestResult(
        this.#mapCucumberScenarioToAllureTestResult(feature, preProcessedScenario, preProcessedSteps),
        {
          readerId,
          metadata: { originalFileName },
        },
      );
    }
  };

  #shouldProcessScenario = ({ type }: PreProcessedScenario) => type !== "background";

  #preProcessSteps = async (visitor: ResultsVisitor, steps: readonly CucumberStep[]) => {
    const preProcessedSteps: PreProcessedStep[] = [];
    for (const step of steps) {
      preProcessedSteps.push(await this.#preProcessOneStep(visitor, step));
    }
    return preProcessedSteps;
  };

  #preProcessOneStep = async (visitor: ResultsVisitor, step: CucumberStep): Promise<PreProcessedStep> => {
    const { keyword, name, result } = step;
    const { status, duration, error_message: errorMessage } = result ?? {};
    return {
      name: ensureString(name)?.trim(),
      keyword: ensureString(keyword)?.trim(),
      status: status ?? "unknown",
      duration: ensureInt(duration),
      errorMessage,
      attachments: await this.#processStepAttachments(visitor, step),
    };
  };

  #processStepAttachments = async (visitor: ResultsVisitor, step: CucumberStep) =>
    [
      await this.#processStepDocStringAttachment(visitor, step.doc_string),
      await this.#processStepDataTableAttachment(visitor, step.rows),
      ...(await this.#processCucumberJsStepArguments(visitor, step.arguments as CucumberJsStepArgument[])),
      ...(await this.#processStepEmbeddingAttachments(visitor, step)),
    ].filter((s): s is RawTestAttachment => typeof s !== "undefined");

  #processStepDocStringAttachment = async (visitor: ResultsVisitor, docString: CucumberDocString | undefined) => {
    if (docString) {
      const { value, content, content_type: contentType } = docString;
      const resolvedValue = ensureString(value ?? content);
      if (resolvedValue && resolvedValue.trim()) {
        return await this.#visitBufferAttachment(
          visitor,
          "Description",
          Buffer.from(resolvedValue),
          ensureString(contentType) || "text/markdown",
        );
      }
    }
  };

  #processStepDataTableAttachment = async (visitor: ResultsVisitor, rows: unknown) => {
    if (isArray(rows)) {
      const content = this.#formatDataTable(rows);
      return await this.#visitBufferAttachment(visitor, "Data", Buffer.from(content), "text/csv");
    }
  };

  #processCucumberJsStepArguments = async (visitor: ResultsVisitor, stepArguments: unknown) => {
    const attachments = [];
    if (isArray(stepArguments)) {
      for (const stepArgument of stepArguments) {
        if (isNonNullObject<CucumberJsStepArgument>(stepArgument)) {
          if ("content" in stepArgument) {
            attachments.push(await this.#processStepDocStringAttachment(visitor, stepArgument));
          } else if ("rows" in stepArgument) {
            attachments.push(await this.#processStepDataTableAttachment(visitor, stepArgument.rows));
          }
        }
      }
    }
    return attachments;
  };

  #processStepEmbeddingAttachments = async (visitor: ResultsVisitor, { embeddings }: CucumberStep) => {
    const attachments: RawTestAttachment[] = [];
    const checkedEmbeddings = ensureArray(embeddings) ?? [];
    const getName = checkedEmbeddings.length > 1 ? (i: number) => `Embedding ${i}` : () => "Embedding";
    const embeddingsWithNames = checkedEmbeddings.map<[unknown, string]>((e, i) => [e, getName(i + 1)]);
    for (const [embedding, fallbackName] of embeddingsWithNames) {
      if (isNonNullObject<CucumberEmbedding>(embedding)) {
        attachments.push(
          await this.#visitBufferAttachment(
            visitor,
            ensureString(embedding.name, fallbackName),
            Buffer.from(ensureString(embedding.data, ""), "base64"),
            ensureString(embedding.mime_type, "application/octet-stream"),
          ),
        );
      }
    }
    return attachments;
  };

  #visitBufferAttachment = async (
    visitor: ResultsVisitor,
    name: string,
    content: Buffer,
    contentType: string,
  ): Promise<RawTestAttachment> => {
    const fileName = randomUUID();
    await visitor.visitAttachmentFile(new BufferResultFile(content, fileName), { readerId });
    return {
      type: "attachment",
      contentType,
      originalFileName: fileName,
      name,
    };
  };

  // CSV formatting follows the rules in https://www.ietf.org/rfc/rfc4180.txt
  #formatDataTable = (rows: readonly unknown[]) => {
    return rows
      .filter(isNonNullObject<CucumberDatatableRow>)
      .map(this.#formatDataTableRow)
      .filter(isString)
      .join("\r\n");
  };

  #formatDataTableRow = ({ cells }: CucumberDatatableRow) => {
    const checkedCells = ensureArray<string>(cells);
    return checkedCells ? checkedCells.map(this.#formatDataTableCell).join(",") : undefined;
  };

  #formatDataTableCell = (cell: string) => {
    const escapedCell = ensureString(cell, "").replaceAll(String.raw`"`, String.raw`""`);
    return `"${escapedCell}"`;
  };

  #isCucumberFeature = ({ keyword, elements }: CucumberFeature) =>
    typeof keyword === "string" && keyword.toLowerCase() === "feature" && Array.isArray(elements);

  #pairWithAllureSteps = (preProcessedCucumberSteps: readonly PreProcessedStep[]) =>
    preProcessedCucumberSteps.map((c) => {
      return {
        preProcessedStep: c,
        allureStep: this.#createAllureStepResult(c),
      };
    });

  #mapCucumberScenarioToAllureTestResult = (
    preProcessedFeature: PreProcessedFeature,
    scenario: PreProcessedScenario,
    preProcessedSteps: readonly PreProcessedStep[],
  ): RawTestResult => {
    const postProcessedSteps = this.#pairWithAllureSteps(preProcessedSteps);
    return {
      fullName: this.#calculateFullName(preProcessedFeature, scenario),
      name: scenario.name ?? TEST_NAME_PLACEHOLDER,
      description: scenario.description,
      duration: this.#convertDuration(this.#calculateTestDuration(postProcessedSteps)),
      steps: postProcessedSteps.map(({ allureStep }) => allureStep),
      labels: this.#calculateTestLabels(preProcessedFeature, scenario),
      ...this.#resolveTestResultStatusProps(postProcessedSteps),
    };
  };

  #calculateTestLabels = (
    { name: featureName, tags: featureTags }: PreProcessedFeature,
    { tags: scenarioTags }: PreProcessedScenario,
  ) => {
    const labels: RawTestLabel[] = [];
    if (featureName) {
      labels.push({ name: "feature", value: featureName });
    }
    labels.push(
      ...featureTags.map((value) => ({ name: "tag", value })),
      ...scenarioTags.map((value) => ({ name: "tag", value })),
    );
    return labels;
  };

  #preProcessFeature = (feature: CucumberFeature): PreProcessedFeature => {
    return {
      id: ensureString(feature.id),
      name: ensureString(feature.name),
      uri: ensureString(feature.uri),
      tags: this.#parseTags(feature.tags),
    };
  };

  #parseTags = (tags: unknown) => {
    return (ensureArray(tags) ?? [])
      .filter(isNonNullObject<CucumberTag>)
      .map(({ name }) => name)
      .filter(isString);
  };

  #preProcessScenario = (scenario: CucumberFeatureElement): PreProcessedScenario => {
    return {
      id: ensureString(scenario.id),
      name: ensureString(scenario.name),
      description: ensureString(scenario.description),
      tags: this.#parseTags(scenario.tags),
      type: scenario.type,
    };
  };

  #calculateFullName = (
    { uri: featureUri, name: featureName, id: featureId }: PreProcessedFeature,
    { name: scenarioName, id: scenarioId }: PreProcessedScenario,
  ) => {
    if (!scenarioName && !scenarioId) {
      return randomUUID();
    }

    // featureUri may contain the feature file's path, hence, is more precise.
    // featureName is the second best choice because it most probably won't have collisions.
    const featurePart = featureUri || featureName || featureId;
    if (featurePart) {
      // scenarioId might have collisions: differenc names are translated into the same id.
      // That's why we're prioritizing scenarioName if the feature part is proven to exist.
      const scenarioPart = scenarioName || scenarioId;
      return `${featurePart}#${scenarioPart!}`;
    }

    // If no feature part found, we're prioritizing scenarioId because there can be the feature id in it.
    return scenarioId || scenarioName;
  };

  #calculateTestDuration = (cucumberAllureStepData: readonly PostProcessedStep[]) =>
    cucumberAllureStepData.reduce<number | undefined>(
      (testDuration, { preProcessedStep: { duration } }) =>
        typeof testDuration === "undefined" ? duration : testDuration + (duration ?? 0),
      undefined,
    );

  #resolveTestResultStatusProps = (
    cucumberAllureSteps: readonly PostProcessedStep[],
  ): { status: RawTestStatus; message?: string; trace?: string } => {
    const stepsData = this.#getCucumberAllureStepWithMaxPriorityStatus(cucumberAllureSteps);
    return stepsData
      ? this.#resolveResultOfTestFromStepsData(stepsData)
      : {
          status: "unknown",
          message: "Step results are missing",
        };
  };

  #resolveResultOfTestFromStepsData = ({
    preProcessedStep: { status: cucumberStatus, errorMessage },
    allureStep: { name, status },
  }: PostProcessedStep) => ({
    status: status ?? "unknown",
    ...this.#resolveTestMessageAndTrace(name!, cucumberStatus, errorMessage),
  });

  #resolveTestMessageAndTrace = (allureStepName: string, status: string, errorMessage: string | undefined) =>
    status !== "passed"
      ? {
          message: this.#resolveTestMessage(status, allureStepName),
          trace: errorMessage,
        }
      : {};

  #resolveTestMessage = (cucumberStepStatus: string | undefined, allureStepName: string) => {
    switch (cucumberStepStatus) {
      case "failed":
        return `The step '${allureStepName}' failed`;
      case "skipped":
        return "One or more steps of the scenario were skipped";
      case "pending":
        return `The step '${allureStepName}' signalled pending during execution`;
      case "undefined":
        return `The step '${allureStepName}' didn't match any definition`;
      case "ambiguous":
        return `The step '${allureStepName}' matched more than one definition`;
      case "unknown":
      default:
        return `The result of the step '${allureStepName}' is unknown`;
    }
  };

  #getCucumberAllureStepWithMaxPriorityStatus = (cucumberAllureSteps: readonly PostProcessedStep[]) => {
    switch (cucumberAllureSteps.length) {
      case 0:
        return undefined;
      case 1:
        return cucumberAllureSteps[0];
      default:
        return cucumberAllureSteps.reduce(this.#statusPriorityReducingFn);
    }
  };

  #statusPriorityReducingFn = (testDefiningStep: PostProcessedStep, currentStep: PostProcessedStep) =>
    allureStepStatusPriorityOrder[testDefiningStep.allureStep.status!] <=
    allureStepStatusPriorityOrder[currentStep.allureStep.status!]
      ? testDefiningStep
      : currentStep;

  #createAllureStepResult = ({
    keyword,
    name,
    status,
    duration,
    errorMessage,
    attachments,
  }: PreProcessedStep): RawTestStepResult => ({
    type: "step",
    name: this.#getAllureStepName(keyword, name),
    steps: attachments,
    ...this.#mapCucumberStepResultToStepProps(status, duration, errorMessage),
  });

  #getAllureStepName = (keyword: string | undefined, name: string | undefined) => {
    if (!name) {
      return keyword ? `${keyword} <${STEP_NAME_PLACEHOLDER.toLowerCase()}>` : STEP_NAME_PLACEHOLDER;
    }
    return keyword ? `${keyword} ${name}` : name;
  };

  #mapCucumberStepResultToStepProps = (
    status: string,
    duration: number | undefined,
    errorMessage: string | undefined,
  ) => ({
    status: cucumberStatusToAllureStatus[status ?? "unknown"] ?? "unknown",
    duration: this.#convertDuration(duration),
    ...this.#resolveStepMessageAndTrace(status, errorMessage),
  });

  #resolveStepMessageAndTrace = (status: string, errorMessage: string | undefined) =>
    status !== "passed" || errorMessage
      ? {
          message: allureStepMessages[status ?? "unknown"] ?? allureStepMessages.unknown,
          trace: errorMessage,
        }
      : {};

  #convertDuration = (duration: number | undefined) =>
    typeof duration !== "undefined" ? this.#nsToMs(duration) : undefined;

  #nsToMs = (ns: number) => Math.round(ns / NS_IN_MS);
}

export const cucumberjson = new CucumberJsonReader();
