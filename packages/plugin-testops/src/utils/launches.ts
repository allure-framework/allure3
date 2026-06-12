import { TestStatus } from "@allurereport/core-api";

import { type TestOpsLaunchStatus } from "../model.js";

export const testStatusToLaunchStatus = (status: TestStatus): TestOpsLaunchStatus => {
  const launchStatus = status === "unknown" ? "unknown" : ["failed", "broken"].includes(status) ? "failed" : "passed";

  return launchStatus;
};
