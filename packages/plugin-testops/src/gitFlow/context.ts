import { GitProvider, type CiDescriptor, type GitFacts } from "@allurereport/core-api";

import type { GitFlowContext } from "./types.js";

export type BuildGitFlowContextParams = {
  ci: CiDescriptor;
  facts?: GitFacts;
  ancestorLimit: number;
};

export const shouldAttachGitFlow = (gitFlow: boolean): boolean => gitFlow;

/**
 * Merges CI descriptor git fields, git facts, and CiDescriptor fallbacks into one Launch Git Context input.
 * Precedence: repository slug from `ci.repository`, else `ci.repoName`; branch from CI, else git HEAD, else job branch.
 */
export const buildGitFlowContext = (params: BuildGitFlowContextParams): GitFlowContext | undefined => {
  const { ci, facts, ancestorLimit } = params;

  if (!facts?.commit) {
    return undefined;
  }

  const repository = ci.repository ?? (ci.repoName ? { slug: ci.repoName } : undefined);

  if (!repository?.slug) {
    return undefined;
  }

  const provider: GitProvider = ci.provider ?? GitProvider.Other;
  const branch = ci.sourceBranch ?? facts.branch ?? ci.jobRunBranch ?? undefined;
  const targetBranch = ci.targetBranch || undefined;
  const pullRequest = ci.pullRequest;

  return {
    provider,
    repository,
    commit: facts.commit,
    branch: branch || undefined,
    targetBranch,
    pullRequest,
    firstParentAncestors: facts.firstParentAncestors,
    ancestorLimit,
    localState: facts.localState,
  };
};
