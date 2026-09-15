import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGitlabClient } from "../../../src/helpers/gitlab/client.js";
import { gitlabEnv, jsonResponse, mockEnv, stubFetch } from "./test-utils.js";

vi.mock("../../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const createStalledResponse = (signal?: AbortSignal | null) => {
  let fail!: (error: unknown) => void;
  const response = new Response(
    new ReadableStream({
      start(controller) {
        fail = (error) => controller.error(error);
        signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")), {
          once: true,
        });
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

  return { response, fail };
};

beforeEach(async () => {
  await story("gitlab client");
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createGitlabClient", () => {
  it("authenticates API requests with the supplied token", async () => {
    mockEnv(gitlabEnv());
    const { calls } = stubFetch(() => jsonResponse({ ok: true }));

    const client = createGitlabClient({ token: "explicit-secret" })!;
    const result = await client.requestJson("GET", "/projects/1");

    expect(result.data).toEqual({ ok: true });
    expect(calls[0].headers["private-token"]).toBe("explicit-secret");
  });

  it.each(["", "env-secret"])(
    "makes anonymous requests without a supplied token when GITLAB_TOKEN is %j",
    async (envToken) => {
      mockEnv(gitlabEnv({ GITLAB_TOKEN: envToken }));
      const { calls } = stubFetch(() => jsonResponse({ ok: true }));

      const client = createGitlabClient({ token: undefined });

      await expect(client.requestJson("GET", "/projects/1")).resolves.toMatchObject({ data: { ok: true } });
      expect(calls).toHaveLength(1);
      expect(calls[0].headers).toEqual({});
    },
  );

  it.each([
    { access: "authenticated", token: "supplied-token", expected: "supplied-token" },
    { access: "anonymous", token: undefined, expected: undefined },
  ])("keeps cross-origin artifact redirects unauthenticated with $access access", async ({ token, expected }) => {
    mockEnv(gitlabEnv());
    const { calls } = stubFetch((call) => {
      if (call.url === "https://gitlab.example.com/api/v4/projects/1/jobs/99/artifacts/history.jsonl") {
        return new Response(null, {
          status: 302,
          headers: { location: "https://cdn.example.net/object/history.jsonl" },
        });
      }

      return new Response("history\n", { status: 200 });
    });

    const client = createGitlabClient({ token });
    expect(client).toBeDefined();
    const bytes = await client!.downloadArtifact("99", "history.jsonl");

    expect(new TextDecoder().decode(bytes)).toBe("history\n");
    expect(calls).toHaveLength(2);
    expect(calls[0].headers["private-token"]).toBe(expected);
    expect(calls[1].url).toBe("https://cdn.example.net/object/history.jsonl");
    expect(calls[1].headers["private-token"]).toBeUndefined();
  });

  it("bounds artifact redirects", async () => {
    mockEnv(gitlabEnv());
    const { calls } = stubFetch(() => {
      const next = calls.length + 1;

      return new Response(null, {
        status: 302,
        headers: { location: `https://gitlab.example.com/api/v4/redirect-${next}` },
      });
    });

    const client = createGitlabClient()!;

    await expect(client.downloadArtifact("99", "history.jsonl")).rejects.toThrow("too many redirects");
    expect(calls).toHaveLength(6);
  });

  it("keeps the request timeout active while reading a prompt GraphQL JSON response body", async () => {
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => nativeTimeout(10));
    mockEnv(gitlabEnv());
    let stalled: ReturnType<typeof createStalledResponse> | undefined;
    const { calls } = stubFetch((call) => {
      stalled = createStalledResponse(call.signal);

      return stalled.response;
    });
    const client = createGitlabClient()!;
    const query = client.query("query Timeout { project { id } }", {});
    try {
      await expect(query).rejects.toThrow("aborted");
      expect(timeout).toHaveBeenCalledWith(10_000);
      expect(calls).toHaveLength(1);
      expect(calls[0].signal?.aborted).toBe(true);
    } finally {
      stalled?.fail(new Error("test cleanup"));
      await query.catch(() => undefined);
    }
  });

  it("rejects non-decimal GitLab identity strings before network I/O", () => {
    mockEnv(gitlabEnv({ CI_PROJECT_ID: "project-1" }));
    const { calls } = stubFetch(() => jsonResponse({ ok: true }));

    expect(() => createGitlabClient()).toThrow("CI_PROJECT_ID");
    expect(calls).toHaveLength(0);
  });

  it("rejects malformed REST API roots before network I/O", () => {
    mockEnv(gitlabEnv({ CI_API_V4_URL: "https://gitlab.example.com/custom" }));
    const { calls } = stubFetch(() => jsonResponse({ ok: true }));

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
    const { calls } = stubFetch(() => jsonResponse({ ok: true }));

    expect(() => createGitlabClient()).toThrow("GitLab API origins do not match");
    expect(calls).toHaveLength(0);
  });
});
