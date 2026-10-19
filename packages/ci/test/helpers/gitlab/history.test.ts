import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { restoreGitlabHistory } from "../../../src/helpers/gitlab/history.js";
import {
  artifactResponse,
  gitlabEnv,
  jsonResponse,
  mockEnv,
  removeDir,
  stubRequest,
  tempGitlabDir,
} from "./test-utils.js";

vi.mock("../../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const previousGitlabJobQuery = `query PreviousGitlabJob($path: ID!, $ref: String!, $source: String!, $job: String!) {
  project(fullPath: $path) {
    pipelines(ref: $ref, source: $source, first: 100) {
      nodes { id source job(name: $job) { id name status retried } }
    }
  }
}`;

const pipelines = [
  { id: "gid://gitlab/Ci::Pipeline/102", source: "push", job: null },
  { id: "gid://gitlab/Ci::Pipeline/100", source: "push", job: null },
  { id: "gid://gitlab/Ci::Pipeline/99", source: "push", job: null },
  {
    id: "gid://gitlab/Ci::Pipeline/98",
    source: "push",
    job: { id: "gid://gitlab/Ci::Build/980", name: "tests", status: "FAILED", retried: false },
  },
  {
    id: "gid://gitlab/Ci::Pipeline/97",
    source: "push",
    job: { id: "gid://gitlab/Ci::Build/970", name: "tests", status: "SUCCESS", retried: false },
  },
];

let tempDir: string | undefined;

beforeEach(async () => {
  await story("gitlab history");
  vi.restoreAllMocks();
  tempDir = await tempGitlabDir();
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (tempDir) {
    await removeDir(tempDir);
  }
});

describe("restoreGitlabHistory", () => {
  it.each([
    { access: "authenticated", token: "supplied-token", expected: "supplied-token" },
    { access: "anonymous", token: undefined, expected: undefined },
  ])(
    "overwrites history with bytes from the first eligible older job with $access access",
    async ({ token, expected }) => {
      const historyPath = join(tempDir!, "history.jsonl");
      await writeFile(historyPath, "existing\n");
      mockEnv(gitlabEnv({ CI_PROJECT_DIR: tempDir! }));
      const { calls } = stubRequest((call) => {
        if (call.method === "POST" && call.url === "https://gitlab.example.com/api/graphql") {
          return jsonResponse({ data: { project: { pipelines: { nodes: pipelines } } } });
        }

        if (
          call.method === "GET" &&
          call.url === "https://gitlab.example.com/api/v4/projects/1/jobs/980/artifacts/history.jsonl"
        ) {
          return artifactResponse("not-json\n");
        }

        throw new Error("unexpected request");
      });

      await restoreGitlabHistory({ historyPath, token });
      expect(await readFile(historyPath, "utf8")).toBe("not-json\n");
      expect(calls.map((call) => call.headers["private-token"])).toEqual([expected, expected]);
      const graphqlCalls = calls.filter((call) => call.method === "POST");
      expect(graphqlCalls).toHaveLength(1);
      expect(graphqlCalls[0].body).toEqual({
        query: previousGitlabJobQuery,
        variables: { path: "group/project", ref: "feature/a", source: "push", job: "tests" },
      });
      const artifactCalls = calls.filter((call) => call.method === "GET");
      expect(artifactCalls.map((call) => call.url)).toEqual([
        "https://gitlab.example.com/api/v4/projects/1/jobs/980/artifacts/history.jsonl",
      ]);
    },
  );

  it("rejects an empty history artifact without requesting fallback artifacts", async () => {
    const historyPath = join(tempDir!, "history.jsonl");
    mockEnv(gitlabEnv({ CI_PROJECT_DIR: tempDir! }));
    const { calls } = stubRequest((call) => {
      if (call.method === "POST") {
        return jsonResponse({ data: { project: { pipelines: { nodes: pipelines } } } });
      }

      if (call.url.endsWith("/jobs/980/artifacts/history.jsonl")) {
        return artifactResponse(new Uint8Array());
      }

      throw new Error("fallback must not be requested");
    });

    await expect(restoreGitlabHistory({ historyPath })).rejects.toThrow("empty history artifact");
    expect(calls.filter((call) => call.method === "GET").map((call) => call.url)).toEqual([
      "https://gitlab.example.com/api/v4/projects/1/jobs/980/artifacts/history.jsonl",
    ]);
  });

  it.each([
    ["source mismatch", [{ id: "gid://gitlab/Ci::Pipeline/99", source: "web", job: null }], "invalid pipeline source"],
    [
      "running job status",
      [
        {
          id: "gid://gitlab/Ci::Pipeline/99",
          source: "push",
          job: { id: "gid://gitlab/Ci::Build/990", name: "tests", status: "RUNNING", retried: false },
        },
      ],
      "no matching prior job in returned pipeline window",
    ],
    [
      "retried job",
      [
        {
          id: "gid://gitlab/Ci::Pipeline/99",
          source: "push",
          job: { id: "gid://gitlab/Ci::Build/990", name: "tests", status: "SUCCESS", retried: true },
        },
      ],
      "no matching prior job in returned pipeline window",
    ],
    [
      "wrong job name",
      [
        {
          id: "gid://gitlab/Ci::Pipeline/99",
          source: "push",
          job: { id: "gid://gitlab/Ci::Build/990", name: "lint", status: "SUCCESS", retried: false },
        },
      ],
      "no matching prior job in returned pipeline window",
    ],
    [
      "all current or newer",
      [
        {
          id: "gid://gitlab/Ci::Pipeline/101",
          source: "push",
          job: { id: "gid://gitlab/Ci::Build/1010", name: "tests", status: "SUCCESS", retried: false },
        },
        {
          id: "gid://gitlab/Ci::Pipeline/100",
          source: "push",
          job: { id: "gid://gitlab/Ci::Build/1000", name: "tests", status: "SUCCESS", retried: false },
        },
      ],
      "no matching prior job in returned pipeline window",
    ],
    [
      "job absent throughout window",
      [{ id: "gid://gitlab/Ci::Pipeline/99", source: "push", job: null }],
      "no matching prior job in returned pipeline window",
    ],
    [
      "ascending pipeline IDs",
      [
        { id: "gid://gitlab/Ci::Pipeline/98", source: "push", job: null },
        { id: "gid://gitlab/Ci::Pipeline/99", source: "push", job: null },
      ],
      "invalid pipeline order",
    ],
  ])("rejects without an artifact request for %s", async (_name, nodes, reason) => {
    const historyPath = join(tempDir!, "history.jsonl");
    mockEnv(gitlabEnv({ CI_PROJECT_DIR: tempDir! }));
    const { calls } = stubRequest((call) => {
      if (call.method === "POST") {
        return jsonResponse({ data: { project: { pipelines: { nodes } } } });
      }

      throw new Error("must not request artifacts");
    });

    await expect(restoreGitlabHistory({ historyPath })).rejects.toThrow(reason);
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["null project", { data: { project: null } }, "invalid project"],
    [
      "GraphQL errors",
      { errors: [{ message: "nope" }], data: { project: { pipelines: { nodes: [] } } } },
      "GitLab GraphQL response contained errors",
    ],
  ])("rejects ambiguous discovery response with %s", async (_name, body, reason) => {
    const historyPath = join(tempDir!, "history.jsonl");
    mockEnv(gitlabEnv({ CI_PROJECT_DIR: tempDir! }));
    const { calls } = stubRequest(() => jsonResponse(body));

    await expect(restoreGitlabHistory({ historyPath })).rejects.toThrow(reason);
    expect(calls).toHaveLength(1);
  });

  it("uses BigInt-safe typed IDs and preserves descending ordering", async () => {
    const historyPath = join(tempDir!, "history.jsonl");
    mockEnv(
      gitlabEnv({
        CI_PROJECT_DIR: tempDir!,
        CI_PIPELINE_ID: "9007199254740993",
      }),
    );
    const { calls } = stubRequest((call) => {
      if (call.method === "POST") {
        return jsonResponse({
          data: {
            project: {
              pipelines: {
                nodes: [
                  {
                    id: "gid://gitlab/Ci::Pipeline/9007199254740994",
                    source: "push",
                    job: {
                      id: "gid://gitlab/Ci::Build/90071992547409940",
                      name: "tests",
                      status: "SUCCESS",
                      retried: false,
                    },
                  },
                  {
                    id: "gid://gitlab/Ci::Pipeline/9007199254740992",
                    source: "push",
                    job: {
                      id: "gid://gitlab/Ci::Build/90071992547409920",
                      name: "tests",
                      status: "SUCCESS",
                      retried: null,
                    },
                  },
                ],
              },
            },
          },
        });
      }

      return artifactResponse("large-id\n");
    });

    await restoreGitlabHistory({ historyPath });
    expect(calls.filter((call) => call.method === "GET").map((call) => call.url)).toEqual([
      "https://gitlab.example.com/api/v4/projects/1/jobs/90071992547409920/artifacts/history.jsonl",
    ]);
  });

  it("encodes endpoint prefixes and project-relative artifact path segments", async () => {
    const historyPath = join(tempDir!, "out", "history files", "history #1.jsonl");
    await mkdir(join(tempDir!, "out", "history files"), { recursive: true });
    mockEnv(
      gitlabEnv({
        CI_PROJECT_DIR: tempDir!,
        CI_SERVER_URL: "https://gitlab.example.com/gitlab",
      }),
    );
    const { calls } = stubRequest((call) => {
      if (call.method === "POST") {
        return jsonResponse({ data: { project: { pipelines: { nodes: pipelines } } } });
      }

      return artifactResponse("prefixed\n");
    });

    await restoreGitlabHistory({ historyPath });
    expect(calls.map((call) => call.url)).toEqual([
      "https://gitlab.example.com/gitlab/api/graphql",
      "https://gitlab.example.com/gitlab/api/v4/projects/1/jobs/980/artifacts/out/history%20files/history%20%231.jsonl",
    ]);
  });

  it("propagates artifact download errors without requesting fallback artifacts", async () => {
    const historyPath = join(tempDir!, "history.jsonl");
    const error = new Error("connection closed");
    mockEnv(gitlabEnv({ CI_PROJECT_DIR: tempDir! }));
    const { calls } = stubRequest((call) => {
      if (call.method === "POST") {
        return jsonResponse({ data: { project: { pipelines: { nodes: pipelines } } } });
      }

      throw error;
    });

    await expect(restoreGitlabHistory({ historyPath })).rejects.toBe(error);
    expect(calls.filter((call) => call.method === "GET").map((call) => call.url)).toEqual([
      "https://gitlab.example.com/api/v4/projects/1/jobs/980/artifacts/history.jsonl",
    ]);
  });

  it("propagates filesystem errors when the history path is a directory", async () => {
    const historyPath = join(tempDir!, "history.jsonl");
    await mkdir(historyPath);
    mockEnv(gitlabEnv({ CI_PROJECT_DIR: tempDir! }));
    stubRequest((call) =>
      call.method === "POST"
        ? jsonResponse({ data: { project: { pipelines: { nodes: pipelines } } } })
        : artifactResponse("downloaded history\n"),
    );

    await expect(restoreGitlabHistory({ historyPath })).rejects.toMatchObject({ code: expect.any(String) });
  });

  it("rejects before network I/O outside GitLab CI", async () => {
    mockEnv(gitlabEnv({ CI_PROJECT_DIR: tempDir!, GITLAB_CI: "" }));
    const { calls } = stubRequest(() => artifactResponse("must not fetch"));

    await expect(restoreGitlabHistory({ historyPath: join(tempDir!, "history.jsonl") })).rejects.toThrow("GitLab CI");
    expect(calls).toHaveLength(0);
  });
});
