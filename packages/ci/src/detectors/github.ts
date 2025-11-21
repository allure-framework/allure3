import { type CiDescriptor, CiType } from "@allurereport/core-api";
import { join } from "node:path/posix";
import { getEnv } from "../utils.js";

const pullRequestSuffixRe = /\/merge$/;

const getBaseURL = () => getEnv("GITHUB_SERVER_URL");

const getRunID = () => getEnv("GITHUB_RUN_ID");

const getWorkflow = () => getEnv("GITHUB_WORKFLOW");

const getRepo = () => getEnv("GITHUB_REPOSITORY");

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
    return getEnv("GITHUB_REF");
  },

  get pullRequestUrl(): string {
    const refName = getEnv("GITHUB_REF_NAME");

    if (!pullRequestSuffixRe.test(refName)) {
      return "";
    }

    const pullRequestNumber = refName.replace(pullRequestSuffixRe, "");
    const serverUrl = getEnv("GITHUB_SERVER_URL");
    const repo = getRepo();
    const pathname = join(repo, "pull", pullRequestNumber);

    return new URL(pathname, serverUrl).toString();
  },

  get pullRequestName(): string {
    const refName = getEnv("GITHUB_REF_NAME");

    if (!pullRequestSuffixRe.test(refName)) {
      return "";
    }

    const pullRequestNumber = refName.replace(pullRequestSuffixRe, "");

    return `Pull request #${pullRequestNumber}`;
  },
};
