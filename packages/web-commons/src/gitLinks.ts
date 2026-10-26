import { CiType, GitProvider, sanitizeExternalUrl } from "@allurereport/core-api";
import type { CiDescriptor } from "@allurereport/core-api";

export type GitLinks = {
  branchUrl?: string;
  commitUrl?: string;
};

const providerByCiType: Partial<Record<CiType, GitProvider>> = {
  [CiType.Github]: GitProvider.Github,
  [CiType.Gitlab]: GitProvider.Gitlab,
  [CiType.Bitbucket]: GitProvider.Bitbucket,
};

// the same paths are used by the cloud and by the self-hosted versions of the providers
const linkPaths: Partial<Record<GitProvider, { branch: string; commit: string }>> = {
  [GitProvider.Github]: { branch: "tree", commit: "commit" },
  [GitProvider.Gitlab]: { branch: "-/tree", commit: "-/commit" },
  [GitProvider.Bitbucket]: { branch: "branch", commit: "commits" },
};

const encodeRefName = (name: string) => name.split("/").map(encodeURIComponent).join("/");

/**
 * Builds the links to the branch and to the commit in the repository of the CI,
 * there are no links when the repository or its provider is unknown
 */
export const getGitLinks = (ci?: CiDescriptor, branch?: string, commit?: string): GitLinks => {
  const repositoryUrl = sanitizeExternalUrl(ci?.repository?.url)?.replace(/\/+$/, "");
  const provider = ci?.provider ?? (ci?.type ? providerByCiType[ci.type] : undefined);
  const paths = provider ? linkPaths[provider] : undefined;

  if (!repositoryUrl || !paths) {
    return {};
  }

  return {
    branchUrl: branch ? `${repositoryUrl}/${paths.branch}/${encodeRefName(branch)}` : undefined,
    commitUrl: commit ? `${repositoryUrl}/${paths.commit}/${encodeURIComponent(commit)}` : undefined,
  };
};
