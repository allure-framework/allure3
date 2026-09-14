import { readFileSync } from "node:fs";

import { getEnv } from "../utils.js";

const PULL_REQUEST_REF_NAME_RE = /^(\d+)\/merge$/;
const PULL_REQUEST_MERGE_REF_RE = /^refs\/pull\/(\d+)\/merge$/;

type GithubPullRequestEventFields = {
  number?: number | string;
  head?: {
    ref?: string;
  };
  base?: {
    ref?: string;
  };
};

type GithubEvent = {
  number?: number | string;
  pull_request?: GithubPullRequestEventFields;
  workflow_run?: {
    event?: string;
    head_branch?: string;
    pull_requests?: GithubPullRequestEventFields[];
  };
};

export type GithubPullRequestContext = {
  number: string;
  headRef?: string;
  baseRef?: string;
};

const normalizePullRequestNumber = (value: number | string | undefined): string => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
};

const nonBlank = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
};

const contextFromPullRequestFields = (
  pullRequest: GithubPullRequestEventFields | undefined,
  fallbackNumber?: number | string,
): GithubPullRequestContext | undefined => {
  const number = normalizePullRequestNumber(pullRequest?.number ?? fallbackNumber);

  if (!number) {
    return undefined;
  }

  return {
    number,
    headRef: nonBlank(pullRequest?.head?.ref),
    baseRef: nonBlank(pullRequest?.base?.ref),
  };
};

export const parsePullRequestContextFromEventJson = (content: string): GithubPullRequestContext | undefined => {
  try {
    const event = JSON.parse(content) as GithubEvent;
    const fromPullRequest = contextFromPullRequestFields(event.pull_request, event.number);

    if (fromPullRequest) {
      return fromPullRequest;
    }

    const workflowPullRequests = event.workflow_run?.pull_requests;

    if (!Array.isArray(workflowPullRequests) || workflowPullRequests.length === 0) {
      return undefined;
    }

    return contextFromPullRequestFields(workflowPullRequests[0]);
  } catch {
    return undefined;
  }
};

export const parsePullRequestNumberFromEventJson = (content: string): string => {
  return parsePullRequestContextFromEventJson(content)?.number ?? "";
};

const readPullRequestContextFromEventPath = (): GithubPullRequestContext | undefined => {
  const eventPath = getEnv("GITHUB_EVENT_PATH");

  if (!eventPath) {
    return undefined;
  }

  try {
    const content = readFileSync(eventPath, "utf-8");

    return parsePullRequestContextFromEventJson(content);
  } catch {
    return undefined;
  }
};

export const resolveGithubPullRequestContext = (): GithubPullRequestContext | undefined => {
  const refName = getEnv("GITHUB_REF_NAME") || "";
  const refNameMatch = refName.match(PULL_REQUEST_REF_NAME_RE);

  if (refNameMatch) {
    return {
      number: refNameMatch[1],
      headRef: nonBlank(getEnv("GITHUB_HEAD_REF")),
      baseRef: nonBlank(getEnv("GITHUB_BASE_REF")),
    };
  }

  const githubRef = getEnv("GITHUB_REF") || "";
  const mergeRefMatch = githubRef.match(PULL_REQUEST_MERGE_REF_RE);

  if (mergeRefMatch) {
    return {
      number: mergeRefMatch[1],
      headRef: nonBlank(getEnv("GITHUB_HEAD_REF")),
      baseRef: nonBlank(getEnv("GITHUB_BASE_REF")),
    };
  }

  return readPullRequestContextFromEventPath();
};

export const resolveGithubPullRequestNumber = (): string => {
  return resolveGithubPullRequestContext()?.number ?? "";
};
