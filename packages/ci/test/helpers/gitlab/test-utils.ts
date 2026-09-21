import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { type Mock, vi } from "vitest";

import { getEnv } from "../../../src/utils.js";

export type RequestCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
};

type ResponseData = Pick<AxiosResponse, "data" | "headers">;

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

export const stubRequest = (handler: (call: RequestCall) => ResponseData | Promise<ResponseData>) => {
  const calls: RequestCall[] = [];
  const request = vi.spyOn(axios, "request").mockImplementation(async (config) => {
    const headers = new AxiosHeaders();
    for (const [name, value] of Object.entries(config.headers ?? {})) {
      headers.set(name, value);
    }
    const call: RequestCall = {
      url: config.url!,
      method: config.method ?? "GET",
      headers: Object.fromEntries(
        Object.entries(headers.toJSON()).map(([key, value]) => [key.toLowerCase(), String(value)]),
      ),
      body: config.data,
    };
    calls.push(call);
    const response = await handler(call);

    return {
      ...response,
      status: 200,
      statusText: "OK",
      config: { ...config, headers },
    };
  });

  return { calls, request };
};

export const jsonResponse = (data: unknown, init?: { headers: Record<string, string> }): ResponseData => ({
  data,
  headers: new AxiosHeaders(init?.headers),
});

export const artifactResponse = (body: string | Uint8Array): ResponseData => ({
  data: typeof body === "string" ? new TextEncoder().encode(body) : body,
  headers: new AxiosHeaders(),
});

export const tempGitlabDir = async () => mkdtemp(join(tmpdir(), "gitlab-ci-helper-"));

export const removeDir = async (path: string) => {
  await rm(path, { recursive: true, force: true });
};
