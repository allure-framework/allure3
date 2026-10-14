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

const previousGitlabJobQuery = `query PreviousGitlabJob($path: ID!, $ref: String!, $source: String, $job: String!) {
  project(fullPath: $path) {
    pipelines(ref: $ref, source: $source, first: 100) {
      nodes { id source job(name: $job) { id name status retried } }
    }
  }
}`;

const mergeRequestEnv = {
  CI_PIPELINE_SOURCE: "merge_request_event",
  CI_MERGE_REQUEST_IID: "7",
  CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: "feature/a",
  CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "release",
  CI_DEFAULT_BRANCH: "main",
};

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

  it("prefers an eligible previous merge-request job over branch history", async () => {
    const historyPath = join(tempDir!, "history.jsonl");
    mockEnv(gitlabEnv({ ...mergeRequestEnv, CI_PROJECT_DIR: tempDir! }));
    const { calls } = stubRequest((call) =>
      call.method === "POST"
        ? jsonResponse({
            data: {
              project: {
                pipelines: {
                  nodes: pipelines.map((node) => ({ ...node, source: "merge_request_event" })),
                },
              },
            },
          })
        : artifactResponse("merge-request history\n"),
    );

    await restoreGitlabHistory({ historyPath });

    expect(calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual([
      {
        query: previousGitlabJobQuery,
        variables: { path: "group/project", ref: "feature/a", source: "merge_request_event", job: "tests" },
      },
    ]);
    expect(calls.filter((call) => call.method === "GET").map((call) => call.url)).toEqual([
      "https://gitlab.example.com/api/v4/projects/1/jobs/980/artifacts/history.jsonl",
    ]);
    expect(await readFile(historyPath, "utf8")).toBe("merge-request history\n");
  });

  it("restores stacked-MR target history using the current pipeline source without a pipeline-ID cutoff", async () => {
    const historyPath = join(tempDir!, "history.jsonl");
    mockEnv(gitlabEnv({ ...mergeRequestEnv, CI_PROJECT_DIR: tempDir! }));
    const { calls } = stubRequest((call) => {
      if (call.method === "POST") {
        const { variables } = call.body as { variables: { ref: string } };
        return jsonResponse({
          data: {
            project: {
              pipelines: {
                nodes:
                  variables.ref === "release"
                    ? [
                        {
                          id: "gid://gitlab/Ci::Pipeline/103",
                          source: "merge_request_event",
                          job: { id: "gid://gitlab/Ci::Build/1030", name: "tests", status: "RUNNING", retried: false },
                        },
                        {
                          id: "gid://gitlab/Ci::Pipeline/102",
                          source: "merge_request_event",
                          job: { id: "gid://gitlab/Ci::Build/1020", name: "tests", status: "FAILED", retried: false },
                        },
                        {
                          id: "gid://gitlab/Ci::Pipeline/99",
                          source: "merge_request_event",
                          job: { id: "gid://gitlab/Ci::Build/990", name: "tests", status: "SUCCESS", retried: false },
                        },
                      ]
                    : [{ id: "gid://gitlab/Ci::Pipeline/100", source: "merge_request_event", job: null }],
              },
            },
          },
        });
      }

      if (call.url.endsWith("/jobs/1020/artifacts/history.jsonl")) {
        return artifactResponse("target-branch history\n");
      }

      throw new Error("unexpected artifact request");
    });

    await restoreGitlabHistory({ historyPath });

    expect(calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual([
      {
        query: previousGitlabJobQuery,
        variables: { path: "group/project", ref: "feature/a", source: "merge_request_event", job: "tests" },
      },
      {
        query: previousGitlabJobQuery,
        variables: { path: "group/project", ref: "release", source: "merge_request_event", job: "tests" },
      },
    ]);
    expect(await readFile(historyPath, "utf8")).toBe("target-branch history\n");
  });

  it.each([
    {
      scenario: "stacked-MR target has no eligible job",
      targetBranch: "release",
      expectedVariables: [
        { path: "group/project", ref: "feature/a", source: "merge_request_event", job: "tests" },
        { path: "group/project", ref: "release", source: "merge_request_event", job: "tests" },
        { path: "group/project", ref: "main", source: null, job: "tests" },
      ],
    },
    {
      scenario: "target branch is unset",
      targetBranch: "",
      expectedVariables: [
        { path: "group/project", ref: "feature/a", source: "merge_request_event", job: "tests" },
        { path: "group/project", ref: "main", source: null, job: "tests" },
      ],
    },
    {
      scenario: "MR targets the default branch",
      targetBranch: "main",
      expectedVariables: [
        { path: "group/project", ref: "feature/a", source: "merge_request_event", job: "tests" },
        { path: "group/project", ref: "main", source: null, job: "tests" },
      ],
    },
  ])("restores default-branch history when $scenario", async ({ targetBranch, expectedVariables }) => {
    const historyPath = join(tempDir!, "history.jsonl");
    mockEnv(
      gitlabEnv({ ...mergeRequestEnv, CI_PROJECT_DIR: tempDir!, CI_MERGE_REQUEST_TARGET_BRANCH_NAME: targetBranch }),
    );
    const { calls } = stubRequest((call) => {
      if (call.method === "POST") {
        const { variables } = call.body as { variables: { ref: string } };
        return jsonResponse({
          data: {
            project: {
              pipelines: {
                nodes:
                  variables.ref === "main"
                    ? [
                        {
                          id: "gid://gitlab/Ci::Pipeline/101",
                          source: "schedule",
                          job: { id: "gid://gitlab/Ci::Build/1010", name: "tests", status: "SUCCESS", retried: null },
                        },
                      ]
                    : [],
              },
            },
          },
        });
      }

      if (call.url.endsWith("/jobs/1010/artifacts/history.jsonl")) {
        return artifactResponse("default-branch history\n");
      }

      throw new Error("unexpected artifact request");
    });

    await restoreGitlabHistory({ historyPath });

    expect(calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual(
      expectedVariables.map((variables) => ({ query: previousGitlabJobQuery, variables })),
    );
    expect(await readFile(historyPath, "utf8")).toBe("default-branch history\n");
  });

  it.each([
    { newestSource: "push", olderSource: "schedule" },
    { newestSource: "schedule", olderSource: "push" },
  ])(
    "restores the newest default-branch job when its source is $newestSource",
    async ({ newestSource, olderSource }) => {
      const historyPath = join(tempDir!, "history.jsonl");
      mockEnv(gitlabEnv({ ...mergeRequestEnv, CI_PROJECT_DIR: tempDir!, CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "main" }));
      const { calls } = stubRequest((call) => {
        if (call.method === "POST") {
          const { variables } = call.body as { variables: { ref: string } };
          return jsonResponse({
            data: {
              project: {
                pipelines: {
                  nodes:
                    variables.ref === "main"
                      ? [
                          {
                            id: "gid://gitlab/Ci::Pipeline/104",
                            source: "web",
                            job: {
                              id: "gid://gitlab/Ci::Build/1040",
                              name: "tests",
                              status: "SUCCESS",
                              retried: false,
                            },
                          },
                          {
                            id: "gid://gitlab/Ci::Pipeline/103",
                            source: newestSource,
                            job: {
                              id: "gid://gitlab/Ci::Build/1030",
                              name: "tests",
                              status: "SUCCESS",
                              retried: false,
                            },
                          },
                          {
                            id: "gid://gitlab/Ci::Pipeline/102",
                            source: olderSource,
                            job: {
                              id: "gid://gitlab/Ci::Build/1020",
                              name: "tests",
                              status: "SUCCESS",
                              retried: false,
                            },
                          },
                        ]
                      : [],
                },
              },
            },
          });
        }

        return artifactResponse("newest default-branch history\n");
      });

      await restoreGitlabHistory({ historyPath });

      expect(calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual([
        {
          query: previousGitlabJobQuery,
          variables: { path: "group/project", ref: "feature/a", source: "merge_request_event", job: "tests" },
        },
        {
          query: previousGitlabJobQuery,
          variables: { path: "group/project", ref: "main", source: null, job: "tests" },
        },
      ]);
      expect(calls.filter((call) => call.method === "GET").map((call) => call.url)).toEqual([
        "https://gitlab.example.com/api/v4/projects/1/jobs/1030/artifacts/history.jsonl",
      ]);
      expect(await readFile(historyPath, "utf8")).toBe("newest default-branch history\n");
    },
  );

  it.each([
    { scenario: "all branches have no eligible job", env: {}, expectedRefs: ["feature/a", "release", "main"] },
    {
      scenario: "target and default branches are equal",
      env: { CI_DEFAULT_BRANCH: "release" },
      expectedRefs: ["feature/a", "release"],
    },
    { scenario: "default branch is unset", env: { CI_DEFAULT_BRANCH: "" }, expectedRefs: ["feature/a", "release"] },
    {
      scenario: "both fallback branches are unset",
      env: { CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "", CI_DEFAULT_BRANCH: "" },
      expectedRefs: ["feature/a"],
    },
    {
      scenario: "pipeline is not a merge request",
      env: { CI_PIPELINE_SOURCE: "push", CI_MERGE_REQUEST_IID: "" },
      expectedRefs: ["feature/a"],
    },
  ])("reports no history when $scenario", async ({ env, expectedRefs }) => {
    const historyPath = join(tempDir!, "history.jsonl");
    mockEnv(gitlabEnv({ ...mergeRequestEnv, CI_PROJECT_DIR: tempDir!, ...env }));
    const { calls } = stubRequest((call) => {
      if (call.method === "POST") {
        return jsonResponse({ data: { project: { pipelines: { nodes: [] } } } });
      }

      throw new Error("must not request artifacts");
    });

    await expect(restoreGitlabHistory({ historyPath })).rejects.toThrow(
      "no matching prior job in returned pipeline window",
    );

    expect(calls.map((call) => (call.body as { variables: { ref: string } }).variables.ref)).toEqual(expectedRefs);
  });

  it("propagates target-branch discovery errors without trying the default branch", async () => {
    const historyPath = join(tempDir!, "history.jsonl");
    mockEnv(gitlabEnv({ ...mergeRequestEnv, CI_PROJECT_DIR: tempDir! }));
    const { calls } = stubRequest((call) => {
      const { variables } = call.body as { variables: { ref: string } };
      return jsonResponse(
        variables.ref === "feature/a"
          ? { data: { project: { pipelines: { nodes: [] } } } }
          : { errors: [{ message: "access denied" }] },
      );
    });

    await expect(restoreGitlabHistory({ historyPath })).rejects.toThrow("GitLab GraphQL response contained errors");

    expect(calls.map((call) => (call.body as { variables: { ref: string } }).variables.ref)).toEqual([
      "feature/a",
      "release",
    ]);
  });

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
