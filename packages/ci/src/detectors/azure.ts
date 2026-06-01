import { type CiDescriptor, CiType, GitProvider } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl, stripRefsHeads } from "../helpers/gitProvider.js";
import { getEnv } from "../utils.js";

export const getRootURL = (): string => getEnv("SYSTEM_COLLECTIONURI");

export const getBuildID = (): string => getEnv("BUILD_BUILDID");

export const getDefinitionID = (): string => getEnv("SYSTEM_DEFINITIONID");

export const getProjectID = (): string => getEnv("SYSTEM_TEAMPROJECTID");

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

const normalizeBranchRef = (branch?: string): string | undefined => {
  const trimmed = branch?.trim() ?? "";

  return trimmed ? stripRefsHeads(trimmed) : undefined;
};

const getRepositoryUrl = () => getEnv("BUILD_REPOSITORY_URI") || getEnv("SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI");

const getRepositoryFromUrl = () => {
  const repositoryUrl = getRepositoryUrl();

  return repositoryUrl ? resolveRepositoryFromGitUrl(repositoryUrl) : undefined;
};

export const azure: CiDescriptor = {
  type: CiType.Azure,

  get detected(): boolean {
    return getEnv("SYSTEM_DEFINITIONID") !== "";
  },

  get repoName(): string {
    const repoName = getEnv("BUILD_REPOSITORY_NAME");

    return repoName.split("/")?.[1] ?? repoName;
  },

  get jobUid(): string {
    return `${getProjectID()}_${getDefinitionID()}`;
  },

  get jobUrl(): string {
    return `${getRootURL()}/${getProjectID()}/_build?definitionId=${getDefinitionID()}`;
  },

  get jobName(): string {
    return getEnv("BUILD_DEFINITIONNAME");
  },

  get jobRunUid(): string {
    return getBuildID();
  },

  get jobRunUrl(): string {
    return `${getRootURL()}/${getProjectID()}/_build/results?buildId=${getBuildID()}`;
  },

  get jobRunName(): string {
    return getEnv("BUILD_BUILDNUMBER");
  },

  get jobRunBranch(): string {
    return getEnv("BUILD_SOURCEBRANCHNAME");
  },

  get pullRequestUrl(): string {
    const repositoryProvider = getEnv("BUILD_REPOSITORY_PROVIDER");
    const repositoryUrl = getEnv("SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI") || getEnv("BUILD_REPOSITORY_URI");
    const pullRequestNumber = getEnv("SYSTEM_PULLREQUEST_PULLREQUESTNUMBER");

    if (!repositoryUrl || !pullRequestNumber) {
      return "";
    }

    if (repositoryProvider === "GitHub") {
      return `${repositoryUrl}/pull/${pullRequestNumber}`;
    }

    if (repositoryProvider === "TfsGit" || repositoryProvider === "TfsVersionControl") {
      return `${repositoryUrl}/pullrequest/${pullRequestNumber}`;
    }

    return "";
  },

  get pullRequestName(): string {
    return "";
  },

  get provider() {
    return getRepositoryFromUrl()?.provider ?? mapAzureRepositoryProvider(getEnv("BUILD_REPOSITORY_PROVIDER"));
  },

  get repository() {
    const repositoryUrl = getRepositoryUrl();
    const fromUrl = repositoryUrl ? resolveRepositoryFromGitUrl(repositoryUrl) : undefined;
    const slug = fromUrl?.slug ?? (getEnv("BUILD_REPOSITORY_NAME") || undefined);

    if (!this.provider || !slug) {
      return undefined;
    }

    return {
      slug,
      url: fromUrl?.url ?? repositoryUrl,
    };
  },

  get sourceBranch() {
    return (
      normalizeBranchRef(getEnv("SYSTEM_PULLREQUEST_SOURCEBRANCH")) ||
      getEnv("BUILD_SOURCEBRANCHNAME") ||
      this.jobRunBranch ||
      undefined
    );
  },

  get targetBranch() {
    return (
      normalizeBranchRef(getEnv("SYSTEM_PULLREQUEST_TARGETBRANCH")) ||
      getEnv("SYSTEM_PULLREQUEST_TARGETBRANCHNAME") ||
      undefined
    );
  },

  get pullRequest() {
    const pullRequestNumber =
      getEnv("SYSTEM_PULLREQUEST_PULLREQUESTNUMBER") || getEnv("SYSTEM_PULLREQUEST_PULLREQUESTID");

    return pullRequestNumber
      ? {
          id: pullRequestNumber,
          url: this.pullRequestUrl || undefined,
          title: this.pullRequestName || undefined,
        }
      : undefined;
  },
};
