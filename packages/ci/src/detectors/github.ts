import { join } from "node:path/posix";

import { type CiDescriptor, CiType, GitProvider } from "@allurereport/core-api";

import { resolveGithubPullRequestNumber } from "../helpers/github.js";
import { stripRefsHeads } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

const getBaseURL = () => getEnv("GITHUB_SERVER_URL");

const getRunID = () => getEnv("GITHUB_RUN_ID");

const getWorkflow = () => getEnv("GITHUB_WORKFLOW");

const getRepo = () => getEnv("GITHUB_REPOSITORY");

const isTagRef = (): boolean => getEnv("GITHUB_REF_TYPE") === "tag" || getEnv("GITHUB_REF").startsWith("refs/tags/");

const getBranchFromRef = (): string => {
  const ref = getEnv("GITHUB_REF");

  if (ref.startsWith("refs/heads/")) {
    return stripRefsHeads(ref);
  }

  if (ref.startsWith("refs/tags/") || ref.startsWith("refs/pull/")) {
    return "";
  }

  return getEnv("GITHUB_REF_TYPE") === "branch" ? getEnv("GITHUB_REF_NAME") : "";
};

const getSourceBranch = (): string => {
  const headRef = getEnv("GITHUB_HEAD_REF");

  if (headRef) {
    return headRef;
  }

  return isTagRef() ? "" : getBranchFromRef();
};

export const github: CiDescriptor = {
  type: CiType.Github,

  get detected(): boolean {
    return getEnv("GITHUB_ACTIONS") !== "";
  },

  get repoName(): string {
    const repo = getRepo();

    return repo.split("/")?.[1] ?? repo;
  },

  get jobUid(): string {
    return `${getRepo()}_${getWorkflow()}`;
  },

  get jobUrl(): string {
    const workflow = encodeURIComponent(`workflow:"${getWorkflow()}"`);

    return `${getBaseURL()}/${getRepo()}/actions?query=${workflow}`;
  },

  get jobName(): string {
    return `${getRepo()} - ${getWorkflow()}`;
  },

  get jobRunUid(): string {
    return getRunID();
  },

  get jobRunUrl(): string {
    return `${getBaseURL()}/${getRepo()}/actions/runs/${getRunID()}`;
  },

  get jobRunName(): string {
    const runNumber = getEnv("GITHUB_RUN_NUMBER");
    const job = getEnv("GITHUB_JOB");

    return `${job} #${runNumber}`;
  },

  get jobRunBranch(): string {
    return getSourceBranch();
  },

  get pullRequestUrl(): string {
    const pullRequestNumber = resolveGithubPullRequestNumber();

    if (!pullRequestNumber) {
      return "";
    }

    const serverUrl = getEnv("GITHUB_SERVER_URL");
    const repo = getRepo();
    const pathname = join(repo, "pull", pullRequestNumber);

    return new URL(pathname, serverUrl).toString();
  },

  get pullRequestName(): string {
    const pullRequestNumber = resolveGithubPullRequestNumber();

    if (!pullRequestNumber) {
      return "";
    }

    return `Pull request #${pullRequestNumber}`;
  },

  get provider() {
    return GitProvider.Github;
  },

  get repository() {
    const repositorySlug = getEnv("GITHUB_REPOSITORY");
    const serverUrl = getEnv("GITHUB_SERVER_URL");

    return repositorySlug
      ? {
          slug: repositorySlug,
          url: serverUrl ? `${serverUrl}/${repositorySlug}` : undefined,
        }
      : undefined;
  },

  get sourceBranch() {
    return getSourceBranch() || undefined;
  },

  get targetBranch() {
    return getEnv("GITHUB_BASE_REF") || undefined;
  },

  get pullRequest() {
    const pullRequestId = resolveGithubPullRequestNumber();

    return pullRequestId
      ? {
          id: pullRequestId,
          url: this.pullRequestUrl || undefined,
          title: this.pullRequestName || undefined,
        }
      : undefined;
  },
};
