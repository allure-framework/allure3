import { GitProvider, type CiDescriptor } from "@allurereport/core-api";

import type {
  GitFlowContext,
  GitProviderType,
  LaunchGitBranchDto,
  LaunchGitContextDto,
  LaunchPullRequestGitflowMetadata,
  LaunchStandaloneGitflowMetadata,
} from "./types.js";

export type ClassifiedPullRequestGitFlowContext = {
  kind: "pull_request";
  context: GitFlowContext;
  sourceBranch: string;
  targetBranch: string;
};

export type ClassifiedBranchGitFlowContext = {
  kind: "branch";
  context: GitFlowContext;
  branch: string;
};

export type ClassifiedStandaloneGitFlowContext = {
  kind: "standalone";
  context: GitFlowContext;
};

export type ClassifiedGitFlowContext =
  | ClassifiedPullRequestGitFlowContext
  | ClassifiedBranchGitFlowContext
  | ClassifiedStandaloneGitFlowContext;

// --- Provider resolution (internal adapter) ---

const mapProvider = (provider: GitProvider): GitProviderType | undefined => {
  switch (provider) {
    case GitProvider.Github:
      return "github";
    case GitProvider.Gitlab:
      return "gitlab";
    case GitProvider.Bitbucket:
      return "bitbucket";
    default:
      return undefined;
  }
};

const hostMatchesProvider = (host: string, providerType: GitProviderType): boolean => {
  switch (providerType) {
    case "github":
      return host === "github.com" || host.endsWith(".github.com") || host.startsWith("github.");
    case "gitlab":
      return host === "gitlab.com" || host.endsWith(".gitlab.com") || host.startsWith("gitlab.");
    case "bitbucket":
      return host === "bitbucket.org" || host.endsWith(".bitbucket.org") || host.startsWith("bitbucket.");
    default:
      return false;
  }
};

const inferProviderTypeFromUrl = (url?: string): GitProviderType | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    const host = new URL(url).hostname.toLowerCase();

    for (const providerType of ["github", "gitlab", "bitbucket"] as const) {
      if (hostMatchesProvider(host, providerType)) {
        return providerType;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const resolveProviderType = (context: GitFlowContext): GitProviderType | undefined =>
  mapProvider(context.provider) ?? inferProviderTypeFromUrl(context.repository.url);

// --- URL templates (internal adapter) ---

const stripGitSuffix = (url: string): string => url.replace(/\.git\/?$/i, "");

const buildRepositoryUrl = (
  providerType: GitProviderType,
  slug: string,
  repositoryUrl?: string,
): string | undefined => {
  if (repositoryUrl) {
    return repositoryUrl;
  }

  if (providerType === "github") {
    return `https://github.com/${slug}.git`;
  }

  if (providerType === "gitlab") {
    return `https://gitlab.com/${slug}`;
  }

  if (providerType === "bitbucket") {
    return `https://bitbucket.org/${slug}.git`;
  }

  return undefined;
};

const buildRepositoryWebUrl = (
  providerType: GitProviderType,
  slug: string,
  repositoryUrl?: string,
): string | undefined => {
  if (repositoryUrl) {
    return stripGitSuffix(repositoryUrl);
  }

  if (providerType === "github") {
    return `https://github.com/${slug}`;
  }

  if (providerType === "gitlab") {
    return `https://gitlab.com/${slug}`;
  }

  if (providerType === "bitbucket") {
    return `https://bitbucket.org/${slug}`;
  }

  return repositoryUrl;
};

const buildCommitUrl = (
  repoWebUrl: string | undefined,
  hash: string,
  providerType: GitProviderType,
): string | undefined => {
  if (!repoWebUrl) {
    return undefined;
  }

  if (providerType === "github") {
    return `${repoWebUrl}/commit/${hash}`;
  }

  if (providerType === "gitlab") {
    return `${repoWebUrl}/-/commit/${hash}`;
  }

  return `${repoWebUrl}/commits/${hash}`;
};

const buildBranchUrl = (
  repoWebUrl: string | undefined,
  branchName: string,
  providerType: GitProviderType,
): string | undefined => {
  if (!repoWebUrl) {
    return undefined;
  }

  if (providerType === "github") {
    return `${repoWebUrl}/tree/${branchName}`;
  }

  if (providerType === "gitlab") {
    return `${repoWebUrl}/-/tree/${branchName}`;
  }

  return `${repoWebUrl}/branch/${branchName}`;
};

const buildPullRequestUrl = (
  repoWebUrl: string | undefined,
  externalId: string,
  providerType: GitProviderType,
  pullRequestUrl?: string,
): string | undefined => {
  if (pullRequestUrl) {
    return pullRequestUrl;
  }

  if (!repoWebUrl) {
    return undefined;
  }

  if (providerType === "github") {
    return `${repoWebUrl}/pull/${externalId}`;
  }

  if (providerType === "gitlab") {
    return `${repoWebUrl}/-/merge_requests/${externalId}`;
  }

  return `${repoWebUrl}/pull-requests/${externalId}`;
};

// --- Wire projection (public interface) ---

const toStandaloneMetadata = (
  localState?: GitFlowContext["localState"],
): LaunchStandaloneGitflowMetadata | undefined => {
  if (!localState) {
    return undefined;
  }

  return {
    hasUncommittedChanges: localState.uncommittedChanges,
    isUnpublishedCommit: localState.unpublishedCommit,
    isUnpublishedBranch: localState.unpublishedBranch,
  };
};

const toPullRequestMetadata = (ci?: CiDescriptor): LaunchPullRequestGitflowMetadata | undefined => {
  if (!ci?.jobRunUid && !ci?.jobRunName) {
    return undefined;
  }

  return {
    workflowRunId: ci.jobRunUid || undefined,
    workflowRunName: ci.jobRunName || undefined,
  };
};

const toBranchDto = (
  name: string,
  providerType: GitProviderType,
  repoWebUrl: string | undefined,
): LaunchGitBranchDto => ({
  name,
  url: buildBranchUrl(repoWebUrl, name, providerType),
});

const buildRepositoryAndCommit = (context: GitFlowContext, providerType: GitProviderType) => {
  const repositoryUrl = buildRepositoryUrl(providerType, context.repository.slug, context.repository.url);
  const repoWebUrl = buildRepositoryWebUrl(providerType, context.repository.slug, repositoryUrl);
  const lineage = context.firstParentAncestors.length > 0 ? context.firstParentAncestors : undefined;

  return {
    repository: {
      providerType,
      name: context.repository.slug,
      url: repositoryUrl,
    },
    commit: {
      hash: context.commit,
      url: buildCommitUrl(repoWebUrl, context.commit, providerType),
      lineage,
    },
    repoWebUrl,
  };
};

/** Maps a classified Git Flow context to the TestOps launch write payload. */
export const projectLaunchGitContext = (
  classified: ClassifiedGitFlowContext,
  ci?: CiDescriptor,
): LaunchGitContextDto | undefined => {
  const context = classified.context;
  const providerType = resolveProviderType(context);

  if (!providerType) {
    return undefined;
  }

  const { repository, commit, repoWebUrl } = buildRepositoryAndCommit(context, providerType);

  if (classified.kind === "pull_request") {
    const { pullRequest } = context;

    if (!pullRequest) {
      return undefined;
    }

    return {
      contextType: "pull_request",
      repository,
      commit,
      pullRequest: {
        externalId: pullRequest.id,
        title: pullRequest.title,
        url: buildPullRequestUrl(repoWebUrl, pullRequest.id, providerType, pullRequest.url),
        sourceBranch: toBranchDto(classified.sourceBranch, providerType, repoWebUrl),
        targetBranch: toBranchDto(classified.targetBranch, providerType, repoWebUrl),
      },
      metadata: toPullRequestMetadata(ci),
    };
  }

  if (classified.kind === "branch") {
    return {
      contextType: "branch",
      repository,
      commit,
      branch: toBranchDto(classified.branch, providerType, repoWebUrl),
    };
  }

  return {
    contextType: "standalone",
    repository,
    commit,
    metadata: toStandaloneMetadata(context.localState),
  };
};
