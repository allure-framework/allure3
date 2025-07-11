import type { CI } from "@allurereport/core-api";

export interface Detector {
  type: CI;
  detected: boolean;
  jobUid: string;
  jobUrl: string;
  jobName: string;
  jobRunUid: string;
  jobRunUrl: string;
  jobRunName: string;
  jobRunBranch: string;
  pullRequestName: string;
  pullRequestUrl: string;
}
