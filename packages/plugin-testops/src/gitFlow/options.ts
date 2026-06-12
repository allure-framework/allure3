import { env } from "node:process";

import { DEFAULT_ANCESTOR_LIMIT } from "@allurereport/git";

import type { TestOpsPluginOptions } from "../model.js";
export type ResolvedGitFlowOptions = {
  gitFlow: boolean;
  ancestorLimit: number;
};

const parseEnvBool = (value?: string): boolean | undefined => {
  if (value === undefined || value === "") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return undefined;
};

const resolveGitFlow = (options: TestOpsPluginOptions): boolean => {
  if (options.gitFlow === true) {
    return true;
  }

  if (options.gitFlow === false) {
    return false;
  }

  return parseEnvBool(env.ALLURE_GIT_FLOW) ?? false;
};

const parseAncestorLimit = (value?: string | number): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return DEFAULT_ANCESTOR_LIMIT;
};

export const resolveGitFlowOptions = (options: TestOpsPluginOptions): ResolvedGitFlowOptions => {
  return {
    gitFlow: resolveGitFlow(options),
    ancestorLimit: parseAncestorLimit(options.ancestorLimit ?? env.ALLURE_GIT_ANCESTOR_LIMIT),
  };
};
