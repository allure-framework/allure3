import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type Mock, vi } from "vitest";

import { getEnv } from "../../../src/utils.js";

export type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal | null;
};

export const mockEnv = (env: Record<string, string>) => {
  (getEnv as Mock).mockImplementation((key: string) => env[key] ?? "");
};

export const gitlabEnv = (overrides: Record<string, string> = {}) => ({
  GITLAB_CI: "true",
  CI_PROJECT_ID: "1",
  CI_PROJECT_NAME: "project",
  CI_PROJECT_PATH: "group/project",
  CI_PROJECT_DIR: "/builds/group/project",
  CI_PIPELINE_ID: "100",
  CI_PIPELINE_SOURCE: "push",
  CI_JOB_ID: "1000",
  CI_JOB_NAME: "tests",
  CI_JOB_URL: "https://gitlab.example.com/group/project/-/jobs/1000",
  CI_COMMIT_REF_NAME: "feature/a",
  CI_SERVER_URL: "https://gitlab.example.com",
  ...overrides,
});

const headersToRecord = (headers: HeadersInit | undefined): Record<string, string> => {
  const result: Record<string, string> = {};

  new Headers(headers).forEach((value, key) => {
    result[key] = value;
  });

  return result;
};

export const stubFetch = (handler: (call: FetchCall) => Response | Promise<Response>) => {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const call: FetchCall = {
      url,
      method,
      headers: headersToRecord(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined,
      signal: init?.signal,
    };

    calls.push(call);

    return handler(call);
  });

  vi.stubGlobal("fetch", fetchMock);

  return { calls, fetchMock };
};

export const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

export const tempGitlabDir = async () => mkdtemp(join(tmpdir(), "gitlab-ci-helper-"));

export const removeDir = async (path: string) => {
  await rm(path, { recursive: true, force: true });
};
