import { type CiDescriptor, sanitizeExternalUrl } from "@allurereport/core-api";
import type { ReportGitInfo } from "@allurereport/plugin-api";

import { getGitLinks } from "./gitLinks.js";

export type CiGitInfo = {
  ciLabel?: string;
  ciUrl?: string;
  isPullRequest: boolean;
  branch?: string;
  branchUrl?: string;
  commit?: string;
  commitUrl?: string;
};

// the local CI descriptor has HEAD instead of the branch in the detached head, it is not a branch
const isKnownBranch = (name?: string): name is string => Boolean(name) && name !== "HEAD";

/**
 * Returns the link to the CI: the pull request, the job run or the job
 */
export const getCiLink = (ci?: CiDescriptor) => (ci ? ci.pullRequestUrl || ci.jobRunUrl || ci.jobUrl : undefined);

/**
 * Returns the name of the CI build: the pull request, the job run or the job, the link when there is no name
 */
export const getCiLabel = (ci?: CiDescriptor, link?: string) => {
  if (!ci) {
    return undefined;
  }

  return ci.pullRequestName || ci.jobRunName || ci.jobName || link;
};

/**
 * Collects the CI build, the branch and the commit of the report with the links to them
 */
export const getCiGitInfo = (ci?: CiDescriptor, git?: ReportGitInfo): CiGitInfo => {
  const branch = [ci?.sourceBranch, ci?.jobRunBranch, git?.branch].find(isKnownBranch);
  const commit = git?.commit;
  const { branchUrl, commitUrl } = getGitLinks(ci, branch, commit);
  const ciLink = getCiLink(ci);

  return {
    ciLabel: getCiLabel(ci, ciLink) || undefined,
    ciUrl: sanitizeExternalUrl(ciLink),
    isPullRequest: Boolean(ci?.pullRequestUrl),
    branch,
    branchUrl,
    commit,
    commitUrl,
  };
};
