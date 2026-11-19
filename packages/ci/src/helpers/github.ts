import { readFileSync } from "node:fs";

import { getEnv } from "../utils.js";
import { stripRefsHeads } from "./gitProvider.js";

const PULL_REQUEST_REF_NAME_RE = /^(\d+)\/merge$/;
const PULL_REQUEST_MERGE_REF_RE = /^refs\/pull\/(\d+)\/merge$/;
/** Merge queue refs: `gh-readonly-queue/<base>/pr-<number>-<sha>` (optionally under `refs/heads/`). */
const MERGE_QUEUE_REF_RE = /(?:^|\/)gh-readonly-queue\/(.+)\/pr-(\d+)-[0-9a-f]{7,40}$/i;

type GithubPullRequestEventFields = {
  number?: number | string;
  title?: string;
  html_url?: string;
  head?: {
    sha?: string;
    ref?: string;
  };
  base?: {
    ref?: string;
  };
};

type GithubMergeGroupFields = {
  head_ref?: string;
  base_ref?: string;
  head_sha?: string;
  base_sha?: string;
};

type GithubEvent = {
  number?: number | string;
  pull_request?: GithubPullRequestEventFields;
  merge_group?: GithubMergeGroupFields;
  workflow_run?: {
    event?: string;
    head_branch?: string;
    head_sha?: string;
    pull_requests?: GithubPullRequestEventFields[];
  };
};

export type GithubPullRequestContext = {
  number?: string;
  title?: string;
  url?: string;
  headRef?: string;
  baseRef?: string;
  headSha?: string;
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
    title: nonBlank(pullRequest?.title),
    url: nonBlank(pullRequest?.html_url),
    headRef: nonBlank(pullRequest?.head?.ref),
    baseRef: nonBlank(pullRequest?.base?.ref),
    headSha: nonBlank(pullRequest?.head?.sha),
  };
};

const parseMergeQueueRef = (
  ref: string | undefined,
): { number?: string; headRef?: string; baseRef?: string } | undefined => {
  const trimmed = nonBlank(ref);

  if (!trimmed) {
    return undefined;
  }

  const withoutPrefix = stripRefsHeads(trimmed);
  const match = withoutPrefix.match(MERGE_QUEUE_REF_RE);

  if (!match) {
    return undefined;
  }

  return {
    number: match[2],
    headRef: withoutPrefix,
    baseRef: match[1],
  };
};

const contextFromMergeGroup = (
  mergeGroup: GithubMergeGroupFields | undefined,
): GithubPullRequestContext | undefined => {
  if (!mergeGroup) {
    return undefined;
  }

  const headRefRaw = nonBlank(mergeGroup.head_ref);
  const baseRefRaw = nonBlank(mergeGroup.base_ref);
  const fromHead = parseMergeQueueRef(headRefRaw);
  const headRef = fromHead?.headRef ?? (headRefRaw ? stripRefsHeads(headRefRaw) : undefined);
  const baseRef = baseRefRaw ? stripRefsHeads(baseRefRaw) : fromHead?.baseRef;

  if (!headRef && !baseRef && !fromHead?.number) {
    return undefined;
  }

  return {
    number: fromHead?.number,
    headRef: nonBlank(headRef),
    baseRef: nonBlank(baseRef),
    headSha: nonBlank(mergeGroup.head_sha),
  };
};

const pullRequestContextFromEvent = (event: GithubEvent): GithubPullRequestContext | undefined => {
  const fromPullRequest = contextFromPullRequestFields(event.pull_request, event.number);

  if (fromPullRequest) {
    return fromPullRequest;
  }

  const workflowPullRequests = event.workflow_run?.pull_requests;

  if (Array.isArray(workflowPullRequests) && workflowPullRequests.length > 0) {
    return contextFromPullRequestFields(workflowPullRequests[0]);
  }

  return contextFromMergeGroup(event.merge_group);
};

export const parsePullRequestContextFromEventJson = (content: string): GithubPullRequestContext | undefined => {
  try {
    return pullRequestContextFromEvent(JSON.parse(content) as GithubEvent);
  } catch {
    return undefined;
  }
};

export const parsePullRequestNumberFromEventJson = (content: string): string => {
  return parsePullRequestContextFromEventJson(content)?.number ?? "";
};

const readGithubEventFromPath = (): GithubEvent | undefined => {
  const eventPath = getEnv("GITHUB_EVENT_PATH");

  if (!eventPath) {
    return undefined;
  }

  try {
    const content = readFileSync(eventPath, "utf-8");

    return JSON.parse(content) as GithubEvent;
  } catch {
    return undefined;
  }
};

const withMatchingEventFields = (
  context: GithubPullRequestContext,
  fromEvent: GithubPullRequestContext | undefined,
): GithubPullRequestContext => {
  if (!fromEvent) {
    return context;
  }

  if (fromEvent.number && context.number && fromEvent.number !== context.number) {
    return context;
  }

  const title = fromEvent.title ?? context.title;
  const url = fromEvent.url ?? context.url;
  const headRef = context.headRef ?? fromEvent.headRef;
  const baseRef = context.baseRef ?? fromEvent.baseRef;
  const headSha = context.headSha ?? fromEvent.headSha;

  return {
    ...context,
    number: context.number || fromEvent.number,
    ...(title ? { title } : {}),
    ...(url ? { url } : {}),
    ...(headRef ? { headRef } : {}),
    ...(baseRef ? { baseRef } : {}),
    ...(headSha ? { headSha } : {}),
  };
};

export const resolveGithubPullRequestContext = (): GithubPullRequestContext | undefined => {
  const event = readGithubEventFromPath();
  const fromEvent = event ? pullRequestContextFromEvent(event) : undefined;
  const refName = getEnv("GITHUB_REF_NAME") || "";
  const refNameMatch = refName.match(PULL_REQUEST_REF_NAME_RE);

  if (refNameMatch) {
    return withMatchingEventFields(
      {
        number: refNameMatch[1],
        headRef: nonBlank(getEnv("GITHUB_HEAD_REF")),
        baseRef: nonBlank(getEnv("GITHUB_BASE_REF")),
      },
      fromEvent,
    );
  }

  const githubRef = getEnv("GITHUB_REF") || "";
  const mergeRefMatch = githubRef.match(PULL_REQUEST_MERGE_REF_RE);

  if (mergeRefMatch) {
    return withMatchingEventFields(
      {
        number: mergeRefMatch[1],
        headRef: nonBlank(getEnv("GITHUB_HEAD_REF")),
        baseRef: nonBlank(getEnv("GITHUB_BASE_REF")),
      },
      fromEvent,
    );
  }

  const fromMergeQueueRef = parseMergeQueueRef(githubRef) ?? parseMergeQueueRef(refName);

  if (fromMergeQueueRef) {
    return withMatchingEventFields(
      {
        number: fromMergeQueueRef.number,
        headRef: nonBlank(getEnv("GITHUB_HEAD_REF")) ?? fromMergeQueueRef.headRef,
        baseRef: nonBlank(getEnv("GITHUB_BASE_REF")) ?? fromMergeQueueRef.baseRef,
      },
      fromEvent,
    );
  }

  return fromEvent;
};

export const resolveGithubCommitSha = (): string | undefined => {
  const event = readGithubEventFromPath();

  return (
    nonBlank(event?.workflow_run?.head_sha) ||
    (event ? pullRequestContextFromEvent(event)?.headSha : undefined) ||
    nonBlank(event?.merge_group?.head_sha) ||
    getEnv("GITHUB_SHA") ||
    undefined
  );
};

export const resolveGithubPullRequestNumber = (): string => {
  return resolveGithubPullRequestContext()?.number ?? "";
};
