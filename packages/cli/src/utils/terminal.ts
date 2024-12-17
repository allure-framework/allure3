import type { TestResult, TestStatus} from "@allurereport/core-api";
import { formatDuration } from "@allurereport/core-api";
import console from "node:console";
import { blue, gray, green, red, yellow } from "yoctocolors";

// TODO move to a separate terminal-commons module
export const status2color = (status: TestStatus) => {
  switch (status) {
    case "failed":
      return red;
    case "broken":
      return yellow;
    case "passed":
      return green;
    case "skipped":
      return gray;
    default:
      return blue;
  }
};

export const logTests = (testResults: TestResult[]) => {
  testResults.forEach((tr) =>
    console.log(
      `${tr.fullName} ${status2color(tr.status)(tr.status)} ${tr.duration !== undefined ? gray(`(${formatDuration(tr.duration)})`) : ""}`,
    ),
  );
};
