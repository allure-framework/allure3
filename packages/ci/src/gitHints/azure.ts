import { type CiDescriptor, type CiGitHints, GitProvider } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl, stripRefsHeads } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

const mapAzureRepositoryProvider = (provider: string): GitProvider | undefined => {
  switch (provider) {
    case "GitHub":
      return GitProvider.Github;
    case "Bitbucket":
      return GitProvider.Bitbucket;
    default:
      return undefined;
  }
};

const normalizeBranchRef = (branch: string): string | undefined => {
  const trimmed = branch.trim();

  return trimmed ? stripRefsHeads(trimmed) : undefined;
};

export const resolveAzureGitHints = (ci: CiDescriptor): CiGitHints => {
  const repositoryUrl = getEnv("BUILD_REPOSITORY_URI") || getEnv("SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI") || undefined;
  const fromUrl = repositoryUrl ? resolveRepositoryFromGitUrl(repositoryUrl) : undefined;
  const fromProvider = mapAzureRepositoryProvider(getEnv("BUILD_REPOSITORY_PROVIDER"));

  const provider = fromUrl?.provider ?? fromProvider;

  if (!provider) {
    return {};
  }

  const slug = fromUrl?.slug ?? (getEnv("BUILD_REPOSITORY_NAME") || undefined);
  const url = fromUrl?.url ?? repositoryUrl;

  if (!slug) {
    return {};
  }

  const pullRequestNumber =
    getEnv("SYSTEM_PULLREQUEST_PULLREQUESTNUMBER") || getEnv("SYSTEM_PULLREQUEST_PULLREQUESTID");
  const pullRequest = pullRequestNumber
    ? {
        id: pullRequestNumber,
        url: ci.pullRequestUrl || undefined,
        title: ci.pullRequestName || undefined,
      }
    : undefined;

  const sourceBranch =
    normalizeBranchRef(getEnv("SYSTEM_PULLREQUEST_SOURCEBRANCH")) ||
    getEnv("BUILD_SOURCEBRANCHNAME") ||
    ci.jobRunBranch ||
    undefined;
  const targetBranch =
    normalizeBranchRef(getEnv("SYSTEM_PULLREQUEST_TARGETBRANCH")) ||
    getEnv("SYSTEM_PULLREQUEST_TARGETBRANCHNAME") ||
    undefined;

  return {
    provider,
    repository: {
      slug,
      url,
    },
    sourceBranch,
    targetBranch,
    pullRequest,
  };
};
