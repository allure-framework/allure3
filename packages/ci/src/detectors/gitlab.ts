import { type CiDescriptor, CiType, GitProvider } from "@allurereport/core-api";

import { getEnv } from "../utils.js";

const GITLAB_DEFAULT_SERVER_URL = "https://gitlab.com";

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const getMergeRequestProjectUrl = (): string => getEnv("CI_MERGE_REQUEST_PROJECT_URL") || getEnv("CI_PROJECT_URL");

const getSourceRef = (): string | undefined =>
  getEnv("CI_MERGE_REQUEST_SOURCE_BRANCH_NAME") || getEnv("CI_COMMIT_REF_NAME") || undefined;

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
    const mergeRequestIID = getEnv("CI_MERGE_REQUEST_IID");

    if (!mergeRequestIID) {
      return "";
    }

    const projectUrl = stripTrailingSlashes(getMergeRequestProjectUrl());

    return projectUrl ? `${projectUrl}/-/merge_requests/${mergeRequestIID}` : "";
  },

  get pullRequestName(): string {
    return getEnv("CI_MERGE_REQUEST_TITLE");
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
    const mergeRequestIid = getEnv("CI_MERGE_REQUEST_IID");

    return mergeRequestIid
      ? {
          id: mergeRequestIid,
          url: this.pullRequestUrl || undefined,
          title: getEnv("CI_MERGE_REQUEST_TITLE") || this.pullRequestName || undefined,
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
      `${new URL(getServerUrl()).protocol}//${getEnv("CI_PROJECT_ROOT_NAMESPACE_SLUG")}.${getEnv("CI_PAGES_DOMAIN") || "gitlab.io"}` +
      `/-/${getEnv("CI_PROJECT_NAME")}/-/jobs/${this.currentJobId}/artifacts`
    );
  },
};
