import { spawnSync } from "node:child_process";
import { basename } from "node:path";

import { type CiDescriptor, CiType } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl } from "../helpers/gitProvider.js";

const readGitRemoteUrl = (): string => {
  const output = spawnSync("git", ["remote", "get-url", "origin"]);

  if (output.error) {
    return "";
  }

  return output.stdout.toString().trim();
};

const getRepository = () => {
  const remoteUrl = readGitRemoteUrl();

  return remoteUrl ? resolveRepositoryFromGitUrl(remoteUrl) : undefined;
};

export const local: CiDescriptor = {
  type: CiType.Local,

  get detected(): boolean {
    return true;
  },

  get repoName(): string {
    const output = spawnSync("git", ["rev-parse", "--show-toplevel"]);

    if (output.error) {
      return "";
    }

    return basename(output.stdout.toString().trim());
  },

  get jobUid(): string {
    return "";
  },

  get jobUrl(): string {
    return "";
  },

  get jobName(): string {
    return "";
  },

  get jobRunUid(): string {
    return "";
  },

  get jobRunUrl(): string {
    return "";
  },

  get jobRunName(): string {
    return "";
  },

  get jobRunBranch(): string {
    const output = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

    if (output.error) {
      return "";
    }

    return output.stdout.toString().trim();
  },

  get pullRequestUrl(): string {
    return "";
  },

  get pullRequestName(): string {
    return "";
  },

  get provider() {
    return getRepository()?.provider;
  },

  get repository() {
    const repository = getRepository();

    return repository
      ? {
          slug: repository.slug,
          url: repository.url,
        }
      : undefined;
  },

  get sourceBranch() {
    return this.jobRunBranch || undefined;
  },
};

export const isLocalCiDescriptor = (ci: CiDescriptor): ci is Omit<CiDescriptor, "type"> & { type: CiType.Local } =>
  ci.type === CiType.Local;
