import { notNull } from "@allure/core-api";
import type {
  RawFixtureResult,
  RawTestAttachment,
  RawTestLabel,
  RawTestLink,
  RawTestParameter,
  RawTestResult,
  RawTestStatus,
  RawTestStepResult,
  ResultsReader,
  ResultsVisitor,
} from "@allure/reader-api";
import { BufferResultFile } from "@allure/reader-api";
import { randomUUID } from "node:crypto";
import type { CucumberFeature, CucumberFeatureElement, CucumberStep } from "./model.js";
import { TEST_NAME_PLACEHOLDER } from "./model.js";
import { ensureString } from "../xml-utils.js";

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
  undefined: "broken",
  ambiguous: "broken",
  failed: "failed",
};

// The interpretation follows https://github.com/cucumber/messages/blob/2e33e6839bf3200eec1a5a7ec6dcb26d46dab410/elixir/messages.proto#L621
const allureStepMessages: Record<string, string> = {
  unknown: "The result of the step is unknown",
  passed: "The step passed",
  skipped: "The step was skipped because the previous step hadn't passed",
  pending: "The step signalled pending during execution",
  undefined: "The step didn't match any definition",
  ambiguous: "The step matched more than one definition",
  failed: "The step failed",
};

type FeatureIdData = {
  featureName: string | undefined;
  featureUri: string | undefined;
  featureId: string | undefined;
};

type ScenarioIdData = {
  scenarioId: string | undefined;
  scenarioName: string | undefined;
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
  async read(visitor, data) {
    const originalFileName = data.getOriginalFileName();
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

    return false;
  },

  readerId: () => readerId,
};

const processFeature = async (visitor: ResultsVisitor, originalFileName: string, feature: CucumberFeature) => {
  if (isCucumberFeature(feature)) {
    for (const scenario of feature.elements) {
      const featureIds = parseFeatureIds(feature);
      await processScenario(visitor, originalFileName, featureIds, scenario);
    }
    return true;
  }
  return false;
};

const processScenario = async (
  visitor: ResultsVisitor,
  originalFileName: string,
  feature: FeatureIdData,
  scenario: CucumberFeatureElement,
) => {
  const preProcessedSteps = await preProcessSteps(visitor, scenario.steps ?? []);
  await visitor.visitTestResult(mapCucumberScenarioToAllureTestResult(feature, scenario, preProcessedSteps), {
    readerId,
    metadata: { originalFileName },
  });
};

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
    name,
    keyword,
    status: status ?? "unknown",
    duration,
    errorMessage,
    attachments: await processStepAttachments(visitor, step),
  };
};

const processStepAttachments = async (visitor: ResultsVisitor, step: CucumberStep) =>
  [await processStepDocStringAttachment(visitor, step)].filter((s): s is RawTestAttachment => typeof s !== "undefined");

const processStepDocStringAttachment = async (
  visitor: ResultsVisitor,
  { doc_string: docString }: CucumberStep,
): Promise<RawTestAttachment | undefined> => {
  if (docString) {
    const { value, content_type: contentType } = docString;
    if (value && value.trim()) {
      const fileName = randomUUID();
      await visitor.visitAttachmentFile(new BufferResultFile(Buffer.from(value), fileName), { readerId });
      return {
        type: "attachment",
        contentType: contentType || "text/markdown",
        originalFileName: fileName,
        name: "Description",
      };
    }
  }
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
  featureIds: FeatureIdData,
  scenario: CucumberFeatureElement,
  preProcessedSteps: readonly PreProcessedStep[],
): RawTestResult => {
  const scenarioIds = parseScenaroiIds(scenario);
  const postProcessedSteps = pairWithAllureSteps(preProcessedSteps);
  return {
    fullName: calculateFullName(featureIds, scenarioIds),
    name: ensureString(scenario.name, TEST_NAME_PLACEHOLDER),
    description: ensureString(scenario.description),
    duration: convertDuration(calculateTestDuration(postProcessedSteps)),
    steps: postProcessedSteps.map(({ allureStep }) => allureStep),
    labels: calculateTestLabels(featureIds),
    ...resolveTestResultStatusProps(postProcessedSteps),
  };
};

const calculateTestLabels = ({ featureName }: FeatureIdData) =>
  featureName ? [{ name: "feature", value: featureName }] : [];

const parseFeatureIds = (feature: CucumberFeature): FeatureIdData => {
  return {
    featureId: ensureString(feature.id),
    featureName: ensureString(feature.name),
    featureUri: ensureString(feature.uri),
  };
};

const parseScenaroiIds = (scenario: CucumberFeatureElement): ScenarioIdData => {
  return {
    scenarioId: ensureString(scenario.id),
    scenarioName: ensureString(scenario.name),
  };
};

const calculateFullName = ({ featureUri, featureName, featureId }: FeatureIdData, { scenarioName, scenarioId }: ScenarioIdData) => {
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
    return `${featurePart}#${scenarioPart}`;
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
  name: `${keyword}${name}`,
  steps: attachments,
  ...mapCucumberStepResultToStepProps(status, duration, errorMessage),
});

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
        message: allureStepMessages[status ?? "unknown"] ?? allureStepMessages["unknown"],
        trace: errorMessage,
      }
    : {};

const convertDuration = (duration: number | undefined) =>
  typeof duration !== "undefined" ? nsToMs(duration) : undefined;

const nsToMs = (ns: number) => Math.round(ns / NS_IN_MS);
