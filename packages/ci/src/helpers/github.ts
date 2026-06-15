import { readFileSync } from "node:fs";

import { getEnv } from "../utils.js";

const PULL_REQUEST_REF_NAME_RE = /^(\d+)\/merge$/;
const PULL_REQUEST_MERGE_REF_RE = /^refs\/pull\/(\d+)\/merge$/;

type GithubPullRequestEvent = {
  number?: number | string;
  pull_request?: {
    number?: number | string;
  };
};

const normalizePullRequestNumber = (value: number | string | undefined): string => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
};

export const parsePullRequestNumberFromEventJson = (content: string): string => {
  try {
    const event = JSON.parse(content) as GithubPullRequestEvent;

    return normalizePullRequestNumber(event?.number ?? event?.pull_request?.number);
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
  const refNameMatch = refName.match(PULL_REQUEST_REF_NAME_RE);

  if (refNameMatch) {
    return refNameMatch[1];
  }

  const githubRef = getEnv("GITHUB_REF") || "";
  const mergeRefMatch = githubRef.match(PULL_REQUEST_MERGE_REF_RE);

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
