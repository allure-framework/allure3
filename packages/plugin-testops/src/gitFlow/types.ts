import type { GitLocalState, GitProvider, GitPullRequestRef, GitRepositoryRef } from "@allurereport/core-api";

export type LaunchGitContextType = "branch" | "standalone" | "pull_request";

/** Matches TestOps {@code GitProviderType} — no {@code other}. */
export type GitProviderType = "github" | "gitlab" | "bitbucket";

export interface LaunchGitRepositoryDto {
  providerType: GitProviderType;
  name: string;
  url?: string;
}

export interface LaunchGitCommitDto {
  hash: string;
  url?: string;
  /** First-parent ancestors, newest first; excludes current {@link hash}. */
  lineage?: string[];
}

export interface LaunchGitBranchDto {
  name: string;
  url?: string;
}

export interface LaunchGitPullRequestDto {
  externalId: string;
  title?: string;
  url?: string;
  sourceBranch: LaunchGitBranchDto;
  targetBranch: LaunchGitBranchDto;
}

export interface LaunchStandaloneGitflowMetadata {
  hasUncommittedChanges?: boolean;
  isUnpublishedCommit?: boolean;
  isUnpublishedBranch?: boolean;
}

export interface LaunchPullRequestGitflowMetadata {
  workflowRunId?: string;
  workflowRunName?: string;
}

/** `gitContext` on `POST /api/launch` — mirrors TestOps {@code LaunchGitContextDto}. */
export interface LaunchGitContextDto {
  contextType: LaunchGitContextType;
  repository: LaunchGitRepositoryDto;
  commit: LaunchGitCommitDto;
  branch?: LaunchGitBranchDto;
  pullRequest?: LaunchGitPullRequestDto;
  metadata?: LaunchStandaloneGitflowMetadata | LaunchPullRequestGitflowMetadata;
}

/** CI hints + git facts before mapping to {@link LaunchGitContextDto}. */
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
