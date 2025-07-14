import { type CiDescriptor, CiType } from "@allurereport/core-api";
import { getEnv } from "../utils.js";

const AMAZON_REGEXP = /^arn:aws:codebuild:([^:]+):([\d]+):(?:build|build-batch)\/([^:]+):([\da-f-]+)$/;
const PIPELINE_REGEXP = /^(?:codepipeline\/)(.+)$/;

export const parseArnValues = (source: string): string[] => {
  if (!source) {
    return [];
  }

  return source.match(AMAZON_REGEXP)?.slice(1) ?? [];
};

export const isBatchBuild = (): boolean => getEnv("CODEBUILD_BUILD_BATCH_TRIGGERED") === "true";

export const getRegionID = (source: string): string => parseArnValues(source)?.[0] ?? "";

export const getAccountID = (source: string): string => parseArnValues(source)?.[1] ?? "";

export const getProjectName = (source: string): string => parseArnValues(source)?.[2] ?? "";

export const getBuildGUID = (source: string): string => parseArnValues(source)?.[3] ?? "";

export const getInitiator = (): string => getEnv("CODEBUILD_INITIATOR");

export const getPipelineName = (): string => {
  const initiator = getInitiator();

  if (!initiator) {
    return "";
  }

  return initiator.match(PIPELINE_REGEXP)?.[1] ?? "";
};

export const amazon: CiDescriptor = {
  type: CiType.Amazon,

  get detected(): boolean {
    const buildArn = getEnv("CODEBUILD_BUILD_ARN");

    return buildArn !== "" && parseArnValues(buildArn).length > 0;
  },

  get jobUid(): string {
    const buildArn = getEnv("CODEBUILD_BUILD_ARN");
    const pipelineName = getPipelineName();

    if (pipelineName) {
      return `pipeline/${pipelineName}`;
    } else if (isBatchBuild()) {
      const projectName = getProjectName(buildArn);

      return `buildbatch/${projectName}`;
    } else {
      const projectName = getProjectName(buildArn);

      return `build/${projectName}`;
    }
  },

  get jobUrl(): string {
    const buildArn = getEnv("CODEBUILD_BUILD_ARN");
    const pipelineName = getPipelineName();

    if (pipelineName) {
      const regionId = getRegionID(buildArn);

      return `https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${pipelineName}/view?region=${regionId}`;
    } else {
      const regionId = getRegionID(buildArn);
      const projectName = getProjectName(buildArn);

      return `https://console.aws.amazon.com/codebuild/home?region=${regionId}#/projects/${projectName}/view/new`;
    }
  },

  get jobName(): string {
    const buildArn = getEnv("CODEBUILD_BUILD_ARN");
    const pipelineName = getPipelineName();

    if (pipelineName) {
      return pipelineName;
    } else {
      return getProjectName(buildArn);
    }
  },

  get jobRunUid(): string {
    const pipelineName = getPipelineName();

    if (pipelineName) {
      return getEnv("CODEBUILD_BUILD_ID");
    } else {
      return getBuildGUID(getEnv("CODEBUILD_BUILD_ARN"));
    }
  },

  get jobRunUrl(): string {
    const pipelineName = getPipelineName();

    if (pipelineName) {
      const buildArn = getEnv("CODEBUILD_BUILD_ARN");
      const executionGuid = getEnv("CODEBUILD_BUILD_ID") || "";
      const regionId = getRegionID(buildArn);

      return `https://console.aws.amazon.com/codesuite/codepipeline/pipelines/${pipelineName}/executions/${executionGuid}/timeline?region=${regionId}`;
    } else if (isBatchBuild()) {
      const buildArn = getEnv("CODEBUILD_BUILD_ARN");
      const accountId = getAccountID(buildArn);
      const projectName = getProjectName(buildArn);
      const buildGuid = getBuildGUID(buildArn);

      return `https://console.aws.amazon.com/codesuite/codebuild/${accountId}/projects/${projectName}/batch/${projectName}:${buildGuid}`;
    } else {
      const buildArn = getEnv("CODEBUILD_BUILD_ARN");
      const regionId = getRegionID(buildArn);
      const projectName = getProjectName(buildArn);
      const buildGuid = getBuildGUID(buildArn);

      return `https://console.aws.amazon.com/codebuild/home?region=${regionId}#/builds/${projectName}:${buildGuid}/view/new`;
    }
  },

  get jobRunName(): string {
    const pipelineName = getPipelineName();

    if (pipelineName) {
      const executionGuid = getEnv("CODEBUILD_BUILD_ID");

      return `${pipelineName}-${executionGuid}`;
    } else {
      const projectName = getProjectName(getEnv("CODEBUILD_BUILD_ARN"));
      const buildNumber = getEnv("CODEBUILD_BUILD_NUMBER");

      return `${projectName}-${buildNumber}`;
    }
  },

  get jobRunBranch(): string {
    return "";
  },

  get pullRequestUrl(): string {
    return "";
  },

  get pullRequestName(): string {
    return "";
  },
};
