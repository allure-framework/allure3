import type { QualityGateRule } from "@allurereport/plugin-api";

import { qualityGateValue } from "./qualityGateValue.js";

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...arguments_: string[]
) => (...arguments_: unknown[]) => Promise<unknown>;

/** Trusted Node.js code, deliberately not a sandbox. Never interpolate data into its source. */
export const compileQualityGateScript = (source: string, path: string): QualityGateRule["validate"] => {
  const failure = (error: unknown) =>
    new Error(`Invalid JavaScript at ${path}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  try {
    const execute = new AsyncFunction("trs", "expected", "state", "metrics", "previousHistory", "environment", source);
    return async ({ trs, expected, state, metrics, previousHistory, environment }) => {
      try {
        const result = await execute(trs, expected, state, metrics, previousHistory, environment);
        if (
          typeof result !== "object" ||
          result === null ||
          Array.isArray(result) ||
          !("success" in result) ||
          typeof result.success !== "boolean" ||
          !Object.hasOwn(result, "actual") ||
          !("actual" in result) ||
          !("testResults" in result) ||
          !Array.isArray(result.testResults) ||
          !result.testResults.every((id: unknown) => typeof id === "string")
        ) {
          throw new TypeError("validator must return { success: boolean, actual: JSON value, testResults: string[] }");
        }
        return { success: result.success, actual: qualityGateValue(result.actual), testResults: result.testResults };
      } catch (error) {
        throw failure(error);
      }
    };
  } catch (error) {
    throw failure(error);
  }
};
