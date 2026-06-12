import { spawnSync } from "node:child_process";

import { type CiDescriptor, type CiGitHints } from "@allurereport/core-api";

import { resolveRepositoryFromGitUrl } from "../helpers/gitProvider.js";

const readGitRemoteUrl = (): string => {
  const output = spawnSync("git", ["remote", "get-url", "origin"]);

  if (output.error) {
    return "";
  }

  return output.stdout.toString().trim();
};

export const resolveLocalGitHints = (ci: CiDescriptor): CiGitHints => {
  const remoteUrl = readGitRemoteUrl();
  const repository = remoteUrl ? resolveRepositoryFromGitUrl(remoteUrl) : undefined;

  if (!repository) {
    return {};
  }

  return {
    provider: repository.provider,
    repository: {
      slug: repository.slug,
      url: repository.url,
    },
    sourceBranch: ci.jobRunBranch || undefined,
  };
};
