import type { GitLocalState, GitProvider, GitPullRequestRef, GitRepositoryRef } from "@allurereport/core-api";

export type ResolvedGitFlowOptions = {
  gitFlow: boolean;
  ancestorLimit: number;
};

/** CI hints and Git facts before mapping to the TestOps launch payload. */
export interface GitFlowContext {
  provider: GitProvider;
  repository: GitRepositoryRef;
  commit: string;
  branch?: string;
  targetBranch?: string;
  pullRequest?: GitPullRequestRef;
  /** First-parent ancestors of `commit`, newest first; does not include `commit`. */
  firstParentAncestors: string[];
  ancestorLimit: number;
  localState?: GitLocalState;
}
