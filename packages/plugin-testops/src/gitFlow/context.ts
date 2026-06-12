import { GitProvider, type CiDescriptor, type CiGitHints, type GitFacts } from "@allurereport/core-api";

import type { GitFlowContext } from "./types.js";

export type BuildGitFlowContextParams = {
  ci: CiDescriptor;
  hints: CiGitHints;
  facts?: GitFacts;
  ancestorLimit: number;
};

export const shouldAttachGitFlow = (gitFlow: boolean): boolean => gitFlow;

/**
 * Merges CI env hints, git facts, and CiDescriptor fallbacks into one Launch Git Context input.
 * Precedence: repository slug from hints, else `ci.repoName`; branch from hints, else git HEAD, else job branch.
 */
export const buildGitFlowContext = (params: BuildGitFlowContextParams): GitFlowContext | undefined => {
  const { ci, hints, facts, ancestorLimit } = params;

  if (!facts?.commit) {
    return undefined;
  }

  const repository = hints.repository ?? (ci.repoName ? { slug: ci.repoName } : undefined);

  if (!repository?.slug) {
    return undefined;
  }

  const provider: GitProvider = hints.provider ?? GitProvider.Other;
  const branch = hints.sourceBranch ?? facts.branch ?? ci.jobRunBranch ?? undefined;
  const targetBranch = hints.targetBranch || undefined;
  const pullRequest = hints.pullRequest;

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
