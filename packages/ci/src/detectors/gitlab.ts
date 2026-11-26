import { type CiDescriptor, CiType, GitProvider } from "@allurereport/core-api";

import { buildPullRequestUrlForProvider } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

const GITLAB_DEFAULT_SERVER_URL = "https://gitlab.com";

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

/** Matches GitLab's CI_*_SLUG rules: lowercase, non [0-9a-z] -> `-`, trim hyphens, max 63 bytes. */
const slugifyGitlabSegment = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length <= 63) {
    return slug;
  }

  return slug.slice(0, 63).replace(/-+$/g, "");
};

const getMergeRequestProjectUrl = (): string => getEnv("CI_MERGE_REQUEST_PROJECT_URL") || getEnv("CI_PROJECT_URL");

const getSourceRef = (): string | undefined =>
  getEnv("CI_MERGE_REQUEST_SOURCE_BRANCH_NAME") || getEnv("CI_COMMIT_REF_NAME") || undefined;

/**
 * Parses `CI_OPEN_MERGE_REQUESTS` (`path!iid[,path!iid...]`, up to 4).
 * Prefers an entry matching `CI_PROJECT_PATH`, otherwise the first entry.
 */
const parseOpenMergeRequestIid = (): string => {
  const openMergeRequests = getEnv("CI_OPEN_MERGE_REQUESTS");

  if (!openMergeRequests) {
    return "";
  }

  const projectPath = getEnv("CI_PROJECT_PATH");
  const entries = openMergeRequests
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.lastIndexOf("!");

      if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
        return undefined;
      }

      return {
        path: entry.slice(0, separatorIndex),
        iid: entry.slice(separatorIndex + 1),
      };
    })
    .filter((entry): entry is { path: string; iid: string } => Boolean(entry?.iid));

  if (entries.length === 0) {
    return "";
  }

  const matching = projectPath ? entries.find((entry) => entry.path === projectPath) : undefined;

  return (matching ?? entries[0]).iid;
};

const getMergeRequestIid = (): string => getEnv("CI_MERGE_REQUEST_IID") || parseOpenMergeRequestIid();

const getProjectRootNamespaceSlug = (): string => {
  const slug = getEnv("CI_PROJECT_ROOT_NAMESPACE_SLUG");

  if (slug) {
    return slug;
  }

  const rootNamespace = getEnv("CI_PROJECT_ROOT_NAMESPACE");

  return rootNamespace ? slugifyGitlabSegment(rootNamespace) : "";
};

const getServerUrl = (): string => stripTrailingSlashes(getEnv("CI_SERVER_URL") || GITLAB_DEFAULT_SERVER_URL);

const getRestApiUrl = (): string => stripTrailingSlashes(getEnv("CI_API_V4_URL") || `${getServerUrl()}/api/v4`);

const getGraphqlApiUrl = (): string => {
  const explicit = getEnv("CI_API_GRAPHQL_URL");

  if (explicit) {
    return stripTrailingSlashes(explicit);
  }

  const restApiUrl = getRestApiUrl();

  return restApiUrl.replace(/\/api\/v4$/, "/api/graphql");
};

export type GitlabCiDescriptor = CiDescriptor & {
  projectId: string;
  projectPath: string;
  projectDirectory: string;
  pipelineSource: string;
  ciJobName: string;
  currentJobId: string;
  currentJobUrl: string;
  mergeRequestProjectId: string;
  restApiUrl: string;
  graphqlApiUrl: string;
  ref: string;
  jobArtifactsUrlBase: string;
};

export const gitlab: GitlabCiDescriptor = {
  type: CiType.Gitlab,

  get detected(): boolean {
    return getEnv("GITLAB_CI") !== "";
  },

  get repoName(): string {
    return getEnv("CI_PROJECT_NAME");
  },

  get jobUid(): string {
    return getEnv("CI_PROJECT_ID");
  },

  get jobUrl(): string {
    return `${getEnv("CI_PROJECT_URL")}/pipelines`;
  },

  get jobName(): string {
    return getEnv("CI_PROJECT_NAME");
  },

  get ciJobName(): string {
    return getEnv("CI_JOB_NAME");
  },

  get pipelineRunName() {
    return getEnv("CI_PIPELINE_NAME") || getEnv("CI_PIPELINE_ID");
  },

  get pipelineRunUrl() {
    return getEnv("CI_PIPELINE_URL") || undefined;
  },

  get jobRunUid(): string {
    return getEnv("CI_PIPELINE_ID");
  },

  get jobRunUrl(): string {
    return getEnv("CI_PIPELINE_URL");
  },

  get jobRunName(): string {
    return getEnv("CI_PIPELINE_ID");
  },

  get jobRunBranch(): string {
    return getSourceRef() || "";
  },

  get pullRequestUrl(): string {
    const mergeRequestIID = getMergeRequestIid();

    if (!mergeRequestIID) {
      return "";
    }

    const projectUrl = stripTrailingSlashes(getMergeRequestProjectUrl());

    return projectUrl ? buildPullRequestUrlForProvider(GitProvider.Gitlab, projectUrl, mergeRequestIID) : "";
  },

  get pullRequestName(): string {
    const title = getEnv("CI_MERGE_REQUEST_TITLE");

    if (title) {
      return title;
    }

    const mergeRequestIid = getMergeRequestIid();

    return mergeRequestIid ? `Merge request !${mergeRequestIid}` : "";
  },

  get commitSha() {
    return getEnv("CI_MERGE_REQUEST_SOURCE_BRANCH_SHA") || getEnv("CI_COMMIT_SHA") || undefined;
  },

  get provider() {
    return GitProvider.Gitlab;
  },

  get repository() {
    const projectPath = getEnv("CI_PROJECT_PATH");

    return projectPath
      ? {
          slug: projectPath,
          url: getEnv("CI_PROJECT_URL") || undefined,
        }
      : undefined;
  },

  get sourceBranch() {
    return getSourceRef();
  },

  get targetBranch() {
    return getEnv("CI_MERGE_REQUEST_TARGET_BRANCH_NAME") || undefined;
  },

  get pullRequest() {
    const mergeRequestIid = getMergeRequestIid();

    return mergeRequestIid
      ? {
          id: mergeRequestIid,
          url: this.pullRequestUrl || undefined,
          title: this.pullRequestName || undefined,
        }
      : undefined;
  },

  get projectId(): string {
    return getEnv("CI_PROJECT_ID");
  },

  get projectPath(): string {
    return getEnv("CI_PROJECT_PATH");
  },

  get projectDirectory(): string {
    return getEnv("CI_PROJECT_DIR");
  },

  get pipelineSource(): string {
    return getEnv("CI_PIPELINE_SOURCE");
  },

  get currentJobId(): string {
    return getEnv("CI_JOB_ID");
  },

  get currentJobUrl(): string {
    return getEnv("CI_JOB_URL");
  },

  get mergeRequestProjectId(): string {
    return getEnv("CI_MERGE_REQUEST_PROJECT_ID");
  },

  get restApiUrl(): string {
    return getRestApiUrl();
  },

  get graphqlApiUrl(): string {
    return getGraphqlApiUrl();
  },

  get ref(): string {
    return getSourceRef() || "";
  },

  get jobArtifactsUrlBase(): string {
    return (
      `${new URL(getServerUrl()).protocol}//${getProjectRootNamespaceSlug()}.${getEnv("CI_PAGES_DOMAIN") || "gitlab.io"}` +
      `/-/${getEnv("CI_PROJECT_NAME")}/-/jobs/${this.currentJobId}/artifacts`
    );
  },
};
