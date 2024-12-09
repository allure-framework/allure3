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
import { randomUUID } from "node:crypto";
import { Category, ExecutorInfo } from "../model.js";
import type { CucumberFeature, CucumberFeatureElement, CucumberStep, CucumberStepResult } from "./model.js";

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

type CucumberAllureStepData = { cucumberStepData: CucumberStepData; allureStep: RawTestStepResult };

type FeatureData = {
  featureName: string;
  featureId: string;
};

type CucumberStepData = {
  keyword?: string;
  name?: string;
  status: string;
  duration?: number;
  errorMessage?: string;
};

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
    const { name: featureName, uri, elements } = feature;
    for (const scenario of elements) {
      await processScenario(visitor, originalFileName, { featureName, featureId: uri }, scenario);
    }
    return true;
  }
  return false;
};

const processScenario = async (
  visitor: ResultsVisitor,
  originalFileName: string,
  feature: FeatureData,
  scenario: CucumberFeatureElement,
) => {
  await visitor.visitTestResult(mapCucumberScenarioToAllureTestResult(feature, scenario), {
    readerId,
    metadata: { originalFileName },
  });
};

const isCucumberFeature = ({ keyword, elements }: CucumberFeature) =>
  typeof keyword === "string" && keyword.toLowerCase() === "feature" && Array.isArray(elements);

const getCucumberAndAllureStepLevelData = (steps: readonly CucumberStep[]) =>
  steps.map((c) => {
    const cucumberStepData = getCucumberStepData(c);
    return {
      cucumberStepData: cucumberStepData,
      allureStep: mapCucumberStepToAllureStepResult(cucumberStepData),
    };
  });

const getCucumberStepData = ({ keyword, name, result }: CucumberStep): CucumberStepData => {
  const { status, duration, error_message: errorMessage } = result ?? {};
  return {
    name,
    keyword,
    status: status ?? "unknown",
    duration,
    errorMessage,
  };
};

const mapCucumberScenarioToAllureTestResult = (
  { featureName, featureId }: FeatureData,
  { name: scenarioName, steps }: CucumberFeatureElement,
) => {
  const cucumberAllureStepData = getCucumberAndAllureStepLevelData(steps ?? []);
  return {
    name: scenarioName,
    fullName: `${featureId}#${scenarioName}`,
    steps: cucumberAllureStepData.map(({ allureStep }) => allureStep),
    labels: [{ name: "feature", value: featureName }],
    ...resolveDurationProperty(calculateRestDuration(cucumberAllureStepData)),
    ...resolveTestResultStatusProps(cucumberAllureStepData),
  };
};

const calculateRestDuration = (cucumberAllureStepData: readonly CucumberAllureStepData[]) =>
  cucumberAllureStepData.reduce<number | undefined>(
    (testDuration, { cucumberStepData: { duration } }) =>
      typeof testDuration === "undefined" ? duration : testDuration + (duration ?? 0),
    undefined,
  );

const resolveTestResultStatusProps = (
  cucumberAllureSteps: readonly CucumberAllureStepData[],
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
  cucumberStepData: { status: cucumberStatus, errorMessage },
  allureStep: { name, status },
}: CucumberAllureStepData) => ({
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

const getCucumberAllureStepWithMaxPriorityStatus = (cucumberAllureSteps: readonly CucumberAllureStepData[]) => {
  switch (cucumberAllureSteps.length) {
    case 0:
      return undefined;
    case 1:
      return cucumberAllureSteps[0];
    default:
      return cucumberAllureSteps.reduce(statusPriorityReducingFn);
  }
};

const statusPriorityReducingFn = (testDefiningStep: CucumberAllureStepData, currentStep: CucumberAllureStepData) =>
  allureStepStatusPriorityOrder[testDefiningStep.allureStep.status!] <=
  allureStepStatusPriorityOrder[currentStep.allureStep.status!]
    ? testDefiningStep
    : currentStep;

const mapCucumberStepToAllureStepResult = ({
  keyword,
  name,
  status,
  duration,
  errorMessage,
}: CucumberStepData): RawTestStepResult => ({
  type: "step",
  name: `${keyword}${name}`,
  ...mapCucumberStepResultToStepProps(status, duration, errorMessage),
});

const mapCucumberStepResultToStepProps = (
  status: string,
  duration: number | undefined,
  errorMessage: string | undefined,
) => {
  return {
    status: cucumberStatusToAllureStatus[status ?? "unknown"],
    ...resolveDurationProperty(duration),
    ...resolveStepMessageAndTrace(status, errorMessage),
  };
};

const resolveStepMessageAndTrace = (status: string, errorMessage: string | undefined) =>
  status !== "passed" || errorMessage
    ? {
        message: allureStepMessages[status ?? "unknown"],
        trace: errorMessage,
      }
    : {};

const resolveDurationProperty = (duration: number | undefined) =>
  typeof duration !== "undefined" ? { duration: nsToMs(duration) } : {};

const nsToMs = (ns: number) => Math.round(ns / NS_IN_MS);
