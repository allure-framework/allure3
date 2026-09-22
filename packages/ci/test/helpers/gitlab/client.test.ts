import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGitlabClient } from "../../../src/helpers/gitlab/client.js";
import { artifactResponse, gitlabEnv, jsonResponse, mockEnv, stubRequest } from "./test-utils.js";

vi.mock("../../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

beforeEach(async () => {
  await story("gitlab client");
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createGitlabClient", () => {
  it("authenticates API requests with the supplied token", async () => {
    mockEnv(gitlabEnv());
    const { calls, request } = stubRequest(() => jsonResponse({ ok: true }));

    const client = createGitlabClient({ token: "explicit-secret" })!;
    const result = await client.requestJson("GET", "/projects/1");

    expect(result.data).toEqual({ ok: true });
    expect(calls[0].headers["private-token"]).toBe("explicit-secret");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ sensitiveHeaders: ["private-token"], timeout: 10_000 }),
    );
  });

  it.each(["", "env-secret"])(
    "makes anonymous requests without a supplied token when GITLAB_TOKEN is %j",
    async (envToken) => {
      mockEnv(gitlabEnv({ GITLAB_TOKEN: envToken }));
      const { calls } = stubRequest(() => jsonResponse({ ok: true }));

      const client = createGitlabClient({ token: undefined });

      await expect(client.requestJson("GET", "/projects/1")).resolves.toMatchObject({ data: { ok: true } });
      expect(calls).toHaveLength(1);
      expect(calls[0].headers).toEqual({});
    },
  );

  it.each([
    { access: "authenticated", token: "supplied-token", expected: "supplied-token" },
    { access: "anonymous", token: undefined, expected: undefined },
  ])("downloads artifact bytes with $access access", async ({ token, expected }) => {
    mockEnv(gitlabEnv());
    const { calls, request } = stubRequest(() => artifactResponse(new Uint8Array([0, 128, 255])));

    const client = createGitlabClient({ token });
    const bytes = await client.downloadArtifact("99", "history.jsonl");

    expect(bytes).toEqual(new Uint8Array([0, 128, 255]));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://gitlab.example.com/api/v4/projects/1/jobs/99/artifacts/history.jsonl");
    expect(calls[0].headers["private-token"]).toBe(expected);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ responseType: "arraybuffer", sensitiveHeaders: ["private-token"], timeout: 10_000 }),
    );
  });

  it("rejects non-decimal GitLab identity strings before network I/O", () => {
    mockEnv(gitlabEnv({ CI_PROJECT_ID: "project-1" }));
    const { calls } = stubRequest(() => jsonResponse({ ok: true }));

    expect(() => createGitlabClient()).toThrow("CI_PROJECT_ID");
    expect(calls).toHaveLength(0);
  });

  it("rejects malformed REST API roots before network I/O", () => {
    mockEnv(gitlabEnv({ CI_API_V4_URL: "https://gitlab.example.com/custom" }));
    const { calls } = stubRequest(() => jsonResponse({ ok: true }));

    expect(() => createGitlabClient()).toThrow("invalid GitLab API endpoint paths");
    expect(calls).toHaveLength(0);
  });

  it("rejects mismatched REST and GraphQL API origins before network I/O", () => {
    mockEnv(
      gitlabEnv({
        CI_API_V4_URL: "https://gitlab.example.com/api/v4",
        CI_API_GRAPHQL_URL: "https://evil.example.com/api/graphql",
      }),
    );
    const { calls } = stubRequest(() => jsonResponse({ ok: true }));

    expect(() => createGitlabClient()).toThrow("GitLab API origins do not match");
    expect(calls).toHaveLength(0);
  });
});
