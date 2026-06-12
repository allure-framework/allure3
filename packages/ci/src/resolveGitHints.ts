import { type CiDescriptor, type CiGitHints, CiType } from "@allurereport/core-api";

import {
  resolveAmazonGitHints,
  resolveAzureGitHints,
  resolveBitbucketGitHints,
  resolveCircleGitHints,
  resolveDroneGitHints,
  resolveGithubGitHints,
  resolveGitlabGitHints,
  resolveJenkinsGitHints,
  resolveLocalGitHints,
} from "./gitHints/index.js";

export const resolveGitHints = (ci: CiDescriptor): CiGitHints => {
  switch (ci.type) {
    case CiType.Amazon:
      return resolveAmazonGitHints(ci);
    case CiType.Azure:
      return resolveAzureGitHints(ci);
    case CiType.Bitbucket:
      return resolveBitbucketGitHints(ci);
    case CiType.Circle:
      return resolveCircleGitHints(ci);
    case CiType.Drone:
      return resolveDroneGitHints(ci);
    case CiType.Github:
      return resolveGithubGitHints(ci);
    case CiType.Gitlab:
      return resolveGitlabGitHints(ci);
    case CiType.Jenkins:
      return resolveJenkinsGitHints(ci);
    case CiType.Local:
      return resolveLocalGitHints(ci);
    default: {
      const exhaustiveCheck: never = ci.type;

      return exhaustiveCheck;
    }
  }
};
