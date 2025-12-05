import { TestStatus } from "@allurereport/core-api";

export const getColorFromStatus = (status: TestStatus) => {
  switch (status) {
    case "passed":
      return "var(--bg-support-castor)";
    case "failed":
      return "var(--bg-support-capella)";
    case "broken":
      return "var(--bg-support-atlas)";
    case "unknown":
      return "var(--bg-support-skat)";
    case "skipped":
      return "var(--bg-support-rau)";
    default:
      return "var(--bg-support-skat)";
  }
};
