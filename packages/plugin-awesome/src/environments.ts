import type { TestResult } from "@allurereport/core-api";
import type { TestResultFilter } from "@allurereport/plugin-api";

export const filterEnv = (env: string, filter?: TestResultFilter) => {
  return (testResult: TestResult) => {
    if (testResult.environment !== env) {
      return false;
    }

    return filter ? filter(testResult) : true;
  };
};
