import { type Detector } from "../model.js";
import { getEnv } from "../utils.js";

export const getRootURL = (): string => getEnv("SYSTEM_COLLECTIONURI");

export const getBuildID = (): string => getEnv("BUILD_BUILDID");

export const getDefinitionID = (): string => getEnv("SYSTEM_DEFINITIONID");

export const getProjectID = (): string => getEnv("SYSTEM_TEAMPROJECTID");

export const azure: Detector = {
  type: "azure",

  get detected(): boolean {
    return getEnv("SYSTEM_DEFINITIONID") !== "";
  },

  get jobUID(): string {
    return `${getProjectID()}_${getDefinitionID()}`;
  },

  get jobURL(): string {
    return `${getRootURL()}/${getProjectID()}/_build?definitionId=${getDefinitionID()}`;
  },

  get jobName(): string {
    return getEnv("BUILD_DEFINITIONNAME");
  },

  get jobRunUID(): string {
    return getBuildID();
  },

  get jobRunURL(): string {
    return `${getRootURL()}/${getProjectID()}/_build/results?buildId=${getBuildID()}`;
  },

  get jobRunName(): string {
    return getEnv("BUILD_BUILDNUMBER");
  },

  get jobRunBranch(): string {
    return getEnv("BUILD_SOURCEBRANCHNAME");
  },
};
