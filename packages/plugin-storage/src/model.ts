import type { CiDescriptor } from "@allurereport/core-api";

export interface StoragePluginOptions {
  accessToken?: string;
}

export const isServiceReportFile = (filename: string) => /^(data|widgets|index\.html$|summary\.json$)/.test(filename);

export const remoteReportParams = (ci: CiDescriptor | undefined): { repo?: string; branch?: string } => {
  const repo = ci?.repoName;
  const branch = ci?.jobRunBranch;

  return repo && branch ? { repo, branch } : {};
};
