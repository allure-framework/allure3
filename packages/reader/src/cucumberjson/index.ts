import type {
  RawTestAttachment,
  RawTestLabel,
  RawTestResult,
  RawTestStatus,
  RawTestStepResult,
  ResultsReader,
  ResultsVisitor,
} from "@allurereport/reader-api";
import { BufferResultFile } from "@allurereport/reader-api";
import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { ensureArray, ensureInt, ensureString, isArray, isNonNullObject, isString } from "../utils.js";
import type {
  CucumberDatatableRow,
  CucumberEmbedding,
  CucumberFeature,
  CucumberFeatureElement,
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

export const cucumberjson: ResultsReader = {
  read: async (visitor, data) => {
    const originalFileName = data.getOriginalFileName();
    if (originalFileName.endsWith(".json")) {
      try {
        const parsed = await data.asJson<CucumberFeature[]>();
        if (parsed) {
          let oneOrMoreFeaturesParsed = false;
          for (const feature of parsed) {
            oneOrMoreFeaturesParsed ||= await processFeature(visitor, originalFileName, feature);
          }
          return oneOrMoreFeaturesParsed;
        }
      } catch (e) {
        console.error("error parsing", originalFileName, e);
        return false;
      }
    }
    return false;
  },

  readerId: () => readerId,
};

const processFeature = async (visitor: ResultsVisitor, originalFileName: string, feature: CucumberFeature) => {
  if (isCucumberFeature(feature)) {
    const preProcessedFeature = preProcessFeature(feature);
    for (const scenario of feature.elements) {
      await processScenario(visitor, originalFileName, preProcessedFeature, scenario);
    }
    return true;
  }
  return false;
};

const processScenario = async (
  visitor: ResultsVisitor,
  originalFileName: string,
  feature: PreProcessedFeature,
  scenario: CucumberFeatureElement,
) => {
  const preProcessedScenario = preProcessScenario(scenario);
  if (shouldProcessScenario(preProcessedScenario)) {
    const preProcessedSteps = await preProcessSteps(visitor, scenario.steps ?? []);
    await visitor.visitTestResult(
      mapCucumberScenarioToAllureTestResult(feature, preProcessedScenario, preProcessedSteps),
      {
        readerId,
        metadata: { originalFileName },
      },
    );
  }
};

const shouldProcessScenario = ({ type }: PreProcessedScenario) => type !== "background";

const preProcessSteps = async (visitor: ResultsVisitor, steps: readonly CucumberStep[]) => {
  const preProcessedSteps: PreProcessedStep[] = [];
  for (const step of steps) {
    preProcessedSteps.push(await preProcessOneStep(visitor, step));
  }
  return preProcessedSteps;
};

const preProcessOneStep = async (visitor: ResultsVisitor, step: CucumberStep): Promise<PreProcessedStep> => {
  const { keyword, name, result } = step;
  const { status, duration, error_message: errorMessage } = result ?? {};
  return {
    name: ensureString(name)?.trim(),
    keyword: ensureString(keyword)?.trim(),
    status: status ?? "unknown",
    duration: ensureInt(duration),
    errorMessage,
    attachments: await processStepAttachments(visitor, step),
  };
};

const processStepAttachments = async (visitor: ResultsVisitor, step: CucumberStep) =>
  [
    await processStepDocStringAttachment(visitor, step),
    await processStepDataTableAttachment(visitor, step),
    ...(await processStepEmbeddingAttachments(visitor, step)),
  ].filter((s): s is RawTestAttachment => typeof s !== "undefined");

const processStepDocStringAttachment = async (
  visitor: ResultsVisitor,
  { doc_string: docString }: CucumberStep,
): Promise<RawTestAttachment | undefined> => {
  if (docString) {
    const { value, content_type: contentType } = docString;
    if (value && value.trim()) {
      return await visitBufferAttachment(visitor, "Description", Buffer.from(value), contentType || "text/markdown");
    }
  }
};

const processStepDataTableAttachment = async (visitor: ResultsVisitor, { rows }: CucumberStep) => {
  if (isArray(rows)) {
    const content = formatDataTable(rows);
    return await visitBufferAttachment(visitor, "Data", Buffer.from(content), "text/csv");
  }
};

const processStepEmbeddingAttachments = async (visitor: ResultsVisitor, { embeddings }: CucumberStep) => {
  const attachments: RawTestAttachment[] = [];
  const checkedEmbeddings = ensureArray(embeddings) ?? [];
  const getName = checkedEmbeddings.length > 1 ? (i: number) => `Embedding ${i}` : () => "Embedding";
  const embeddingsWithNames = checkedEmbeddings.map<[unknown, string]>((e, i) => [e, getName(i + 1)]);
  for (const [embedding, fallbackName] of embeddingsWithNames) {
    if (isNonNullObject<CucumberEmbedding>(embedding)) {
      attachments.push(
        await visitBufferAttachment(
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

const visitBufferAttachment = async (
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
const formatDataTable = (rows: readonly unknown[]) => {
  return rows
    .filter(isNonNullObject<CucumberDatatableRow>)
    .map(formatDataTableRow)
    .filter(isString)
    .join("\r\n");
};

const formatDataTableRow = ({ cells }: CucumberDatatableRow) => {
  const checkedCells = ensureArray<string>(cells);
  return checkedCells ? checkedCells.map(formatDataTableCell).join(",") : undefined;
};

const formatDataTableCell = (cell: string) => {
  const escapedCell = ensureString(cell, "").replaceAll(String.raw`"`, String.raw`""`);
  return `"${escapedCell}"`;
};

const isCucumberFeature = ({ keyword, elements }: CucumberFeature) =>
  typeof keyword === "string" && keyword.toLowerCase() === "feature" && Array.isArray(elements);

const pairWithAllureSteps = (preProcessedCucumberSteps: readonly PreProcessedStep[]) =>
  preProcessedCucumberSteps.map((c) => {
    return {
      preProcessedStep: c,
      allureStep: createAllureStepResult(c),
    };
  });

const mapCucumberScenarioToAllureTestResult = (
  preProcessedFeature: PreProcessedFeature,
  scenario: PreProcessedScenario,
  preProcessedSteps: readonly PreProcessedStep[],
): RawTestResult => {
  const postProcessedSteps = pairWithAllureSteps(preProcessedSteps);
  return {
    fullName: calculateFullName(preProcessedFeature, scenario),
    name: scenario.name ?? TEST_NAME_PLACEHOLDER,
    description: scenario.description,
    duration: convertDuration(calculateTestDuration(postProcessedSteps)),
    steps: postProcessedSteps.map(({ allureStep }) => allureStep),
    labels: calculateTestLabels(preProcessedFeature, scenario),
    ...resolveTestResultStatusProps(postProcessedSteps),
  };
};

const calculateTestLabels = (
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

const preProcessFeature = (feature: CucumberFeature): PreProcessedFeature => {
  return {
    id: ensureString(feature.id),
    name: ensureString(feature.name),
    uri: ensureString(feature.uri),
    tags: parseTags(feature.tags),
  };
};

const parseTags = (tags: unknown) => {
  return (ensureArray(tags) ?? [])
    .filter(isNonNullObject<CucumberTag>)
    .map(({ name }) => name)
    .filter(isString);
};

const preProcessScenario = (scenario: CucumberFeatureElement): PreProcessedScenario => {
  return {
    id: ensureString(scenario.id),
    name: ensureString(scenario.name),
    description: ensureString(scenario.description),
    tags: parseTags(scenario.tags),
    type: scenario.type,
  };
};

const calculateFullName = (
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

const calculateTestDuration = (cucumberAllureStepData: readonly PostProcessedStep[]) =>
  cucumberAllureStepData.reduce<number | undefined>(
    (testDuration, { preProcessedStep: { duration } }) =>
      typeof testDuration === "undefined" ? duration : testDuration + (duration ?? 0),
    undefined,
  );

const resolveTestResultStatusProps = (
  cucumberAllureSteps: readonly PostProcessedStep[],
): { status: RawTestStatus; message?: string; trace?: string } => {
  const stepsData = getCucumberAllureStepWithMaxPriorityStatus(cucumberAllureSteps);
  return stepsData
    ? resolveResultOfTestFromStepsData(stepsData)
    : {
        status: "unknown",
        message: "Step results are missing",
      };
};

const resolveResultOfTestFromStepsData = ({
  preProcessedStep: { status: cucumberStatus, errorMessage },
  allureStep: { name, status },
}: PostProcessedStep) => ({
  status: status ?? "unknown",
  ...resolveTestMessageAndTrace(name!, cucumberStatus, errorMessage),
});

const resolveTestMessageAndTrace = (allureStepName: string, status: string, errorMessage: string | undefined) =>
  status !== "passed"
    ? {
        message: resolveTestMessage(status, allureStepName),
        trace: errorMessage,
      }
    : {};

const resolveTestMessage = (cucumberStepStatus: string | undefined, allureStepName: string) => {
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

const getCucumberAllureStepWithMaxPriorityStatus = (cucumberAllureSteps: readonly PostProcessedStep[]) => {
  switch (cucumberAllureSteps.length) {
    case 0:
      return undefined;
    case 1:
      return cucumberAllureSteps[0];
    default:
      return cucumberAllureSteps.reduce(statusPriorityReducingFn);
  }
};

const statusPriorityReducingFn = (testDefiningStep: PostProcessedStep, currentStep: PostProcessedStep) =>
  allureStepStatusPriorityOrder[testDefiningStep.allureStep.status!] <=
  allureStepStatusPriorityOrder[currentStep.allureStep.status!]
    ? testDefiningStep
    : currentStep;

const createAllureStepResult = ({
  keyword,
  name,
  status,
  duration,
  errorMessage,
  attachments,
}: PreProcessedStep): RawTestStepResult => ({
  type: "step",
  name: getAllureStepName(keyword, name),
  steps: attachments,
  ...mapCucumberStepResultToStepProps(status, duration, errorMessage),
});

const getAllureStepName = (keyword: string | undefined, name: string | undefined) => {
  if (!name) {
    return keyword ? `${keyword} <${STEP_NAME_PLACEHOLDER.toLowerCase()}>` : STEP_NAME_PLACEHOLDER;
  }
  return keyword ? `${keyword} ${name}` : name;
};

const mapCucumberStepResultToStepProps = (
  status: string,
  duration: number | undefined,
  errorMessage: string | undefined,
) => ({
  status: cucumberStatusToAllureStatus[status ?? "unknown"] ?? "unknown",
  duration: convertDuration(duration),
  ...resolveStepMessageAndTrace(status, errorMessage),
});

const resolveStepMessageAndTrace = (status: string, errorMessage: string | undefined) =>
  status !== "passed" || errorMessage
    ? {
        message: allureStepMessages[status ?? "unknown"] ?? allureStepMessages.unknown,
        trace: errorMessage,
      }
    : {};

const convertDuration = (duration: number | undefined) =>
  typeof duration !== "undefined" ? nsToMs(duration) : undefined;

const nsToMs = (ns: number) => Math.round(ns / NS_IN_MS);
