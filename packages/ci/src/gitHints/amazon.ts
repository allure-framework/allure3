import { type CiDescriptor, type CiGitHints } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl, stripRefsHeads } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

const parseBranchFromSourceVersion = (sourceVersion: string): string | undefined => {
  const branchMatch = sourceVersion.match(/refs\/heads\/(?<branch>[^/^]+)/)?.groups?.branch;

  if (branchMatch) {
    return branchMatch;
  }

  const branchTrigger = getEnv("CODEBUILD_WEBHOOK_TRIGGER");

  if (branchTrigger.startsWith("branch/")) {
    return branchTrigger.slice("branch/".length);
  }

  return undefined;
};

const parsePullRequestFromSourceVersion = (sourceVersion: string): string | undefined => {
  const prPrefixMatch = sourceVersion.match(/^pr\/(?<id>\d+)$/i)?.groups?.id;

  if (prPrefixMatch) {
    return prPrefixMatch;
  }

  return sourceVersion.match(/refs\/pull\/(?<id>\d+)\//)?.groups?.id;
};

const parsePullRequestFromWebhookTrigger = (): string | undefined => {
  const trigger = getEnv("CODEBUILD_WEBHOOK_TRIGGER");

  return trigger.match(/^pr\/(?<id>\d+)$/i)?.groups?.id;
};

export const resolveAmazonGitHints = (ci: CiDescriptor): CiGitHints => {
  const repoUrl = getEnv("CODEBUILD_SOURCE_REPO_URL");
  const repository = repoUrl ? resolveRepositoryFromGitUrl(repoUrl) : undefined;

  if (!repository) {
    return {};
  }

  const sourceVersion = getEnv("CODEBUILD_SOURCE_VERSION");
  const pullRequestId = parsePullRequestFromWebhookTrigger() || parsePullRequestFromSourceVersion(sourceVersion);
  const pullRequest = pullRequestId
    ? {
        id: pullRequestId,
        url: ci.pullRequestUrl || undefined,
        title: ci.pullRequestName || undefined,
      }
    : undefined;

  const headRef = getEnv("CODEBUILD_WEBHOOK_HEAD_REF");

  return {
    provider: repository.provider,
    repository: {
      slug: repository.slug,
      url: repository.url,
    },
    sourceBranch:
      (headRef ? stripRefsHeads(headRef) : undefined) ||
      parseBranchFromSourceVersion(sourceVersion) ||
      ci.jobRunBranch ||
      undefined,
    targetBranch: stripRefsHeads(getEnv("CODEBUILD_WEBHOOK_BASE_REF")) || undefined,
    pullRequest,
  };
};
