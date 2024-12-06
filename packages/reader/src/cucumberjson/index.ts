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
import type { CucumberFeature, CucumberStep } from "./model.js";

const NS_IN_MS = 1000_000;

const readerId = "cucumberjson";

export const cucumberjson: ResultsReader = {
  async read(visitor, data) {
    const originalFileName = data.getOriginalFileName();
    try {
      const parsed = await data.asJson<CucumberFeature[]>();
      if (parsed) {
        for (const { uri, name: featureName, elements } of parsed) {
          for (const { name: scenarioName, steps: cucumberSteps } of elements) {
            const cucumberAllureStepPairs = (cucumberSteps ?? []).map<[CucumberStep, RawTestStepResult]>((c) => {
              c.result ??= { status: "unknown" };
              return [c, getStepStatusWithData(c)];
            });

            const rawTestResult: RawTestResult = {
              name: scenarioName,
              fullName: `${uri}#${scenarioName}`,
              testId: "!",
              historyId: "!",
              steps: cucumberAllureStepPairs.map(([, s]) => s),
              labels: [{ name: "feature", value: featureName }],
            };

            if (cucumberAllureStepPairs.length) {
              const [testDefiningCucumberStep, testDefiningAllureStep] = getTestDefiningStep(cucumberAllureStepPairs);
              switch (testDefiningCucumberStep?.result?.status) {
                case "failed":
                  rawTestResult.status = "failed";
                  rawTestResult.message = `The step '${testDefiningAllureStep?.name}' failed`;
                  rawTestResult.trace = testDefiningAllureStep?.trace;
                  break;
                case "skipped":
                  rawTestResult.status = "skipped";
                  rawTestResult.message = "One or more steps of the scenario were skipped";
                  rawTestResult.trace = testDefiningAllureStep?.trace;
                  break;
                case "pending":
                  rawTestResult.status = "skipped";
                  rawTestResult.message = `The step '${testDefiningAllureStep?.name}' signalled pending during execution`;
                  rawTestResult.trace = testDefiningAllureStep?.trace;
                  break;
                case "undefined":
                  rawTestResult.status = "broken";
                  rawTestResult.message = `The step '${testDefiningAllureStep?.name}' didn't match any definition`;
                  rawTestResult.trace = testDefiningAllureStep?.trace;
                  break;
                case "ambiguous":
                  rawTestResult.status = "broken";
                  rawTestResult.message = `The step '${testDefiningAllureStep?.name}' matched more than one definition`;
                  rawTestResult.trace = testDefiningAllureStep?.trace;
                  break;
                case "passed":
                  rawTestResult.status = "passed";
                  break;
                case "unknown":
                default:
                  rawTestResult.status = "unknown";
                  rawTestResult.message = `The result of the step '${testDefiningAllureStep?.name}' is unknown`;
                  rawTestResult.trace = testDefiningAllureStep?.trace;
                  break;
              }
            } else {
              rawTestResult.status = "unknown";
              rawTestResult.message = "No steps found";
            }

            visitor.visitTestResult(rawTestResult, { readerId, metadata: { originalFileName } });
            return true;
          }
        }
      }
    } catch (e) {
      console.error("error parsing", originalFileName, e);
      return false;
    }

    return false;
  },

  readerId: () => readerId,
};

const getTestDefiningStep = (stepPairs: [CucumberStep, RawTestStepResult][]) => {
  return [...stepPairs].sort(
    ([, a], [, b]) => allureStepStatusWeights[a.status ?? "unknown"] - allureStepStatusWeights[b.status ?? "unknown"],
  )[0];
};

const allureStepStatusWeights = {
  failed: 0,
  broken: 1,
  unknown: 2,
  skipped: 3,
  passed: 4,
};

const getStepStatusWithData = ({ keyword, name, result: { status, error_message, duration } }: CucumberStep) => {
  const allureStepName = `${keyword}${name}`;
  const allureStepStart = 0;
  const allureStepDuration = nsToMs(duration ?? 0);
  const allureStepStop = allureStepDuration;
  const allureStepStatus = mapCucumberStatusToAllure(status);
  const rawStepResult: RawTestStepResult = {
    type: "step",
    name: allureStepName,
    status: allureStepStatus,
    start: allureStepStart,
    duration: allureStepDuration,
    stop: allureStepStop,
  };

  switch (status) {
    case "passed":
      rawStepResult.status = "passed";
      if (error_message) {
        rawStepResult.message = "The step passed";
      }
      break;
    case "failed":
      rawStepResult.status = "failed";
      rawStepResult.message = "The step failed";
      break;
    case "skipped":
      rawStepResult.status = "skipped";
      rawStepResult.message = "The step was skipped because the previous step hadn't passed";
      break;
    case "pending":
      rawStepResult.status = "skipped";
      rawStepResult.message = "The step signalled pending during execution";
      break;
    case "undefined":
      rawStepResult.status = "broken";
      rawStepResult.message = "The step didn't match any definition";
      break;
    case "ambiguous":
      rawStepResult.status = "broken";
      rawStepResult.message = "The step matched more than one definition";
      break;
    case "unknown":
    default:
      rawStepResult.status = "unknown";
      rawStepResult.message = "The result of the step is unknown";
      break;
  }

  if (error_message) {
    rawStepResult.trace = error_message;
  }

  return rawStepResult;
};

const mapCucumberStatusToAllure = (status: string) => {
  switch (status) {
    case "passed":
    case "failed":
      return status;
    default:
      return "unknown";
  }
};

const nsToMs = (ns: number) => Math.floor(ns / NS_IN_MS);
