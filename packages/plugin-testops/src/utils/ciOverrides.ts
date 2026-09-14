import { env } from "node:process";

import { GitProvider, type CiDescriptor, type GitFacts, type GitPullRequestRef } from "@allurereport/core-api";

type OverridableStringField =
  | "jobUid"
  | "jobUrl"
  | "jobName"
  | "jobRunUid"
  | "jobRunUrl"
  | "jobRunName"
  | "jobRunBranch"
  | "sourceBranch"
  | "targetBranch"
  | "pullRequestName"
  | "pullRequestUrl";

const OVERRIDABLE_STRING_FIELDS: readonly [OverridableStringField, string][] = [
  ["jobUid", "ALLURE_JOB_UID"],
  ["jobUrl", "ALLURE_JOB_URL"],
  ["jobName", "ALLURE_JOB_NAME"],
  ["jobRunUid", "ALLURE_JOB_RUN_UID"],
  ["jobRunUrl", "ALLURE_JOB_RUN_URL"],
  ["jobRunName", "ALLURE_JOB_RUN_NAME"],
  ["jobRunBranch", "ALLURE_JOB_RUN_BRANCH"],
  ["sourceBranch", "ALLURE_CI_SOURCE_BRANCH"],
  ["targetBranch", "ALLURE_CI_TARGET_BRANCH"],
  ["pullRequestName", "ALLURE_CI_PULL_REQUEST_TITLE"],
  ["pullRequestUrl", "ALLURE_CI_PULL_REQUEST_URL"],
];

const GIT_PROVIDER_VALUES = new Set<string>(Object.values(GitProvider));

const nonBlank = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
};

const parseGitProvider = (value: string | undefined): GitProvider | undefined => {
  const normalized = nonBlank(value)?.toLowerCase();

  if (!normalized || !GIT_PROVIDER_VALUES.has(normalized)) {
    return undefined;
  }

  return normalized as GitProvider;
};

const parseFirstParentAncestors = (value: string | undefined): string[] | undefined => {
  const raw = nonBlank(value);

  if (raw === undefined) {
    return undefined;
  }

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

/**
 * Merges PR id/url/title when an id is available (env or existing).
 * Returns undefined when no id exists — caller must not replace `ci.pullRequest`.
 */
const resolvePullRequestOverride = (ci: CiDescriptor): GitPullRequestRef | undefined => {
  const id = nonBlank(env.ALLURE_CI_PULL_REQUEST_ID) ?? nonBlank(ci.pullRequest?.id);
  const url = nonBlank(env.ALLURE_CI_PULL_REQUEST_URL) ?? ci.pullRequest?.url;
  const title = nonBlank(env.ALLURE_CI_PULL_REQUEST_TITLE) ?? ci.pullRequest?.title;

  if (!id) {
    return undefined;
  }

  return {
    id,
    url,
    title,
  };
};

/**
 * Builds repository override from slug and/or URL env.
 * Slug comes only from `ALLURE_CI_REPOSITORY_SLUG` or existing `ci.repository.slug`
 * (never from repoName). Without a resolvable slug, returns undefined.
 */
const resolveRepositoryOverride = (
  ci: CiDescriptor,
  repositorySlugOverride: string | undefined,
  repositoryUrlOverride: string | undefined,
): CiDescriptor["repository"] | undefined => {
  if (!repositorySlugOverride && !repositoryUrlOverride) {
    return undefined;
  }

  const slug = repositorySlugOverride ?? nonBlank(ci.repository?.slug);

  if (!slug) {
    return undefined;
  }

  return {
    slug,
    url: repositoryUrlOverride ?? ci.repository?.url,
  };
};

export const applyCiOverrides = (ci: CiDescriptor): CiDescriptor => {
  const overrides: Partial<Record<OverridableStringField, string>> = {};

  for (const [field, envVar] of OVERRIDABLE_STRING_FIELDS) {
    const value = nonBlank(env[envVar]);

    if (value) {
      overrides[field] = value;
    }
  }

  const repoNameOverride = nonBlank(env.ALLURE_CI_REPO_NAME);
  const repositorySlugOverride = nonBlank(env.ALLURE_CI_REPOSITORY_SLUG);
  const repositoryUrlOverride = nonBlank(env.ALLURE_CI_REPOSITORY_URL);
  const providerOverride = parseGitProvider(env.ALLURE_CI_GIT_PROVIDER);
  const repository = resolveRepositoryOverride(ci, repositorySlugOverride, repositoryUrlOverride);

  const hasPullRequestEnv = Boolean(
    nonBlank(env.ALLURE_CI_PULL_REQUEST_ID) ||
    nonBlank(env.ALLURE_CI_PULL_REQUEST_URL) ||
    nonBlank(env.ALLURE_CI_PULL_REQUEST_TITLE),
  );
  // Only merge the pullRequest object when an id can be resolved; URL/title-only
  // updates still flow through OVERRIDABLE_STRING_FIELDS without clearing pullRequest.
  const pullRequest = hasPullRequestEnv ? resolvePullRequestOverride(ci) : undefined;
  const hasPullRequestObjectOverride = pullRequest !== undefined;
  const hasRepoNameOverride = Boolean(repoNameOverride);
  const hasRepositoryOverride = repository !== undefined;
  const hasProviderOverride = providerOverride !== undefined;

  if (
    Object.keys(overrides).length === 0 &&
    !hasPullRequestObjectOverride &&
    !hasRepoNameOverride &&
    !hasRepositoryOverride &&
    !hasProviderOverride
  ) {
    return ci;
  }

  return {
    ...ci,
    ...overrides,
    ...(hasRepoNameOverride ? { repoName: repoNameOverride } : {}),
    ...(hasRepositoryOverride ? { repository } : {}),
    ...(hasProviderOverride ? { provider: providerOverride } : {}),
    ...(hasPullRequestObjectOverride ? { pullRequest } : {}),
  };
};

/**
 * Applies ALLURE_CI_COMMIT / ALLURE_CI_FIRST_PARENT_ANCESTORS on top of collected git facts.
 * Keeps first-parent ancestors only when the commit is unchanged or ancestors are provided via env.
 */
export const applyGitFactsOverrides = (facts: GitFacts | undefined): GitFacts | undefined => {
  const commitOverride = nonBlank(env.ALLURE_CI_COMMIT);
  const ancestorsOverride = parseFirstParentAncestors(env.ALLURE_CI_FIRST_PARENT_ANCESTORS);

  if (!commitOverride && ancestorsOverride === undefined) {
    return facts;
  }

  if (commitOverride) {
    if (!facts) {
      return {
        commit: commitOverride,
        firstParentAncestors: ancestorsOverride ?? [],
        branch: undefined,
      };
    }

    const commitUnchanged = facts.commit === commitOverride;

    return {
      ...facts,
      commit: commitOverride,
      firstParentAncestors:
        ancestorsOverride !== undefined ? ancestorsOverride : commitUnchanged ? facts.firstParentAncestors : [],
    };
  }

  if (!facts?.commit) {
    return facts;
  }

  return {
    ...facts,
    firstParentAncestors: ancestorsOverride!,
  };
};
