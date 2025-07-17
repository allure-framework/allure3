import { type CiDescriptor, CiType } from "@allurereport/core-api";
import { getEnv } from "../utils.js";

export const getRootURL = (): string => getEnv("SYSTEM_COLLECTIONURI");

export const getBuildID = (): string => getEnv("BUILD_BUILDID");

export const getDefinitionID = (): string => getEnv("SYSTEM_DEFINITIONID");

export const getProjectID = (): string => getEnv("SYSTEM_TEAMPROJECTID");

export const azure: CiDescriptor = {
  type: CiType.Azure,

  get detected(): boolean {
    return getEnv("SYSTEM_DEFINITIONID") !== "";
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
    const repositoryUrl = getEnv("SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI");
    const pullRequestNumber = getEnv("SYSTEM_PULLREQUEST_PULLREQUESTNUMBER");

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
};
