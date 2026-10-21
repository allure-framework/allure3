import type { GitProvider, GitPullRequestRef, GitRepositoryRef } from "./gitFlow.js";

export enum CiType {
  Amazon = "amazon",
  Azure = "azure",
  Bitbucket = "bitbucket",
  Circle = "circle",
  Drone = "drone",
  Github = "github",
  Gitlab = "gitlab",
  Jenkins = "jenkins",
  Local = "local",
}

/** Commit context associated with report generation, using the source revision when supplied by CI. */
export interface ReportCommit {
  sha: string;
  url?: string;
}

export interface CiDescriptor {
  commit?: ReportCommit;
  type: CiType;
  detected: boolean;
  repoName: string;
  jobUid: string;
  jobUrl: string;
  jobName: string;
  jobRunUid: string;
  jobRunUrl: string;
  jobRunName: string;
  jobRunBranch: string;
  pullRequestName: string;
  pullRequestUrl: string;
  provider?: GitProvider;
  repository?: GitRepositoryRef;
  sourceBranch?: string;
  targetBranch?: string;
  pullRequest?: GitPullRequestRef;
}
