import type { SeverityLevel, TestStatus } from "@allurereport/core-api";

export const statusColors: Record<TestStatus, string> = {
  failed: "var(--bg-support-capella)",
  broken: "var(--bg-support-atlas)",
  passed: "var(--bg-support-castor)",
  skipped: "var(--bg-support-rau)",
  unknown: "var(--bg-support-skat)",
};

export const severityColors: Record<SeverityLevel, string> = {
  blocker: "var(--bg-support-capella)",
  critical: "var(--bg-support-atlas)",
  normal: "var(--bg-support-castor)",
  minor: "var(--bg-support-rau)",
  trivial: "var(--bg-support-skat)",
};
