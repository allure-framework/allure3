import { readFileSync } from "node:fs";

import { getEnv } from "../utils.js";

const pullRequestSuffixRe = /\/merge$/;
const pullRequestMergeRefRe = /^refs\/pull\/(\d+)\/merge$/;

export const parsePullRequestNumberFromEventJson = (content: string): string => {
  try {
    const event = JSON.parse(content) as { pull_request?: { number?: number } };
    const number = event?.pull_request?.number;

    if (number === undefined || number === null) {
      return "";
    }

    return String(number);
  } catch {
    return "";
  }
};

const readPullRequestNumberFromEventPath = (): string => {
  const eventPath = getEnv("GITHUB_EVENT_PATH");

  if (!eventPath) {
    return "";
  }

  try {
    const content = readFileSync(eventPath, "utf-8");

    return parsePullRequestNumberFromEventJson(content);
  } catch {
    return "";
  }
};

export const resolveGithubPullRequestNumber = (): string => {
  const refName = getEnv("GITHUB_REF_NAME") || "";

  if (pullRequestSuffixRe.test(refName)) {
    return refName.replace(pullRequestSuffixRe, "");
  }

  const githubRef = getEnv("GITHUB_REF") || "";
  const mergeRefMatch = githubRef.match(pullRequestMergeRefRe);

  if (mergeRefMatch) {
    return mergeRefMatch[1];
  }

  const headRef = getEnv("GITHUB_HEAD_REF");
  const baseRef = getEnv("GITHUB_BASE_REF");

  if (headRef && baseRef) {
    return readPullRequestNumberFromEventPath();
  }

  return "";
};
