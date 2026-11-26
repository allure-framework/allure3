import { GitProvider, type CiDescriptor, type GitFacts } from "@allurereport/core-api";

import type { GitFlowContext } from "./types.js";

export type BuildGitFlowContextParams = {
  ci: CiDescriptor;
  facts?: GitFacts;
  ancestorLimit: number;
};

export const shouldAttachGitFlow = (gitFlow: boolean): boolean => gitFlow;

const nonBlank = (value?: string): string | undefined => {
  const trimmed = value?.trim();

  return trimmed || undefined;
};

/**
 * Merges CI descriptor git fields, git facts, and CiDescriptor fallbacks into one Launch Git Context input.
 * Precedence: repository slug from `ci.repository`, else `ci.repoName`; branch from CI, else git HEAD, else job branch.
 */
export const buildGitFlowContext = (params: BuildGitFlowContextParams): GitFlowContext | undefined => {
  const { ci, facts, ancestorLimit } = params;

  if (!facts?.commit) {
    return undefined;
  }

  const fallbackRepoName = nonBlank(ci.repoName);
  const repository = ci.repository?.slug ? ci.repository : fallbackRepoName ? { slug: fallbackRepoName } : undefined;

  if (!repository?.slug) {
    return undefined;
  }

  const provider: GitProvider = ci.provider ?? GitProvider.Other;
  const branch = nonBlank(ci.sourceBranch) ?? nonBlank(facts.branch) ?? nonBlank(ci.jobRunBranch);
  const targetBranch = nonBlank(ci.targetBranch);
  const pullRequest = ci.pullRequest;

  return {
    provider,
    repository,
    commit: facts.commit,
    branch,
    targetBranch,
    pullRequest,
    firstParentAncestors: facts.firstParentAncestors,
    ancestorLimit,
    localState: facts.localState,
  };
};
