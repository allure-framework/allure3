import { readFileSync } from "node:fs";

import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  parsePullRequestContextFromEventJson,
  parsePullRequestNumberFromEventJson,
  resolveGithubPullRequestContext,
  resolveGithubPullRequestNumber,
} from "../src/helpers/github.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parsePullRequestNumberFromEventJson", () => {
  it("returns pull request number from event payload", () => {
    expect(
      parsePullRequestNumberFromEventJson(JSON.stringify({ pull_request: { number: 77, title: "Fix things" } })),
    ).toBe("77");
  });

  it("returns pull request number from top-level event payload number", () => {
    expect(
      parsePullRequestNumberFromEventJson(JSON.stringify({ number: 78, pull_request: { title: "Fix things" } })),
    ).toBe("78");
  });

  it("returns empty string for invalid JSON", () => {
    expect(parsePullRequestNumberFromEventJson("{not-json")).toBe("");
  });

  it("returns empty string when pull_request is missing", () => {
    expect(parsePullRequestNumberFromEventJson(JSON.stringify({ action: "opened" }))).toBe("");
  });

  it("returns empty string when pull_request.number is missing", () => {
    expect(parsePullRequestNumberFromEventJson(JSON.stringify({ pull_request: { title: "No number" } }))).toBe("");
  });

  it("returns pull request number from workflow_run.pull_requests", () => {
    expect(
      parsePullRequestNumberFromEventJson(
        JSON.stringify({
          workflow_run: {
            event: "pull_request",
            pull_requests: [{ number: 920, head: { ref: "feat/x" }, base: { ref: "main" } }],
          },
        }),
      ),
    ).toBe("920");
  });
});

describe("parsePullRequestContextFromEventJson", () => {
  it("returns title, url, head and base refs from pull_request payload", () => {
    expect(
      parsePullRequestContextFromEventJson(
        JSON.stringify({
          pull_request: {
            number: 12,
            title: "Fix things",
            html_url: "https://github.com/org/repo/pull/12",
            head: { ref: "feature/foo" },
            base: { ref: "main" },
          },
        }),
      ),
    ).toEqual({
      number: "12",
      title: "Fix things",
      url: "https://github.com/org/repo/pull/12",
      headRef: "feature/foo",
      baseRef: "main",
    });
  });

  it("returns head and base refs from workflow_run.pull_requests", () => {
    expect(
      parsePullRequestContextFromEventJson(
        JSON.stringify({
          workflow_run: {
            event: "pull_request",
            head_branch: "feature/foo",
            pull_requests: [
              {
                number: 33,
                head: { ref: "feature/foo" },
                base: { ref: "main" },
              },
            ],
          },
        }),
      ),
    ).toEqual({
      number: "33",
      headRef: "feature/foo",
      baseRef: "main",
    });
  });

  it("returns title from workflow_run.pull_requests when present", () => {
    expect(
      parsePullRequestContextFromEventJson(
        JSON.stringify({
          workflow_run: {
            event: "pull_request",
            pull_requests: [
              {
                number: 34,
                title: "Workflow PR",
                head: { ref: "feature/bar" },
                base: { ref: "main" },
              },
            ],
          },
        }),
      ),
    ).toEqual({
      number: "34",
      title: "Workflow PR",
      headRef: "feature/bar",
      baseRef: "main",
    });
  });

  it("returns undefined when workflow_run.pull_requests is empty", () => {
    expect(
      parsePullRequestContextFromEventJson(
        JSON.stringify({
          workflow_run: {
            event: "pull_request",
            pull_requests: [],
          },
        }),
      ),
    ).toBeUndefined();
  });

  it("returns head and base refs from merge_group payload", () => {
    expect(
      parsePullRequestContextFromEventJson(
        JSON.stringify({
          merge_group: {
            head_ref: "refs/heads/gh-readonly-queue/main/pr-3089-686be27e553fcc593f8ddb139c8b539ebbd1f273",
            base_ref: "refs/heads/main",
            head_sha: "e26bd29e4fe9a8373d704d3cd25bb08c83b6a6b4",
            base_sha: "686be27e553fcc593f8ddb139c8b539ebbd1f273",
          },
        }),
      ),
    ).toEqual({
      number: "3089",
      headRef: "gh-readonly-queue/main/pr-3089-686be27e553fcc593f8ddb139c8b539ebbd1f273",
      baseRef: "main",
      headSha: "e26bd29e4fe9a8373d704d3cd25bb08c83b6a6b4",
    });
  });

  it("returns branches from merge_group even when PR number cannot be parsed", () => {
    expect(
      parsePullRequestContextFromEventJson(
        JSON.stringify({
          merge_group: {
            head_ref: "refs/heads/feature/queued",
            base_ref: "refs/heads/develop",
          },
        }),
      ),
    ).toEqual({
      headRef: "feature/queued",
      baseRef: "develop",
    });
  });
});

describe("resolveGithubPullRequestNumber", () => {
  it("resolves pull request id from GITHUB_REF_NAME merge suffix", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      if (key === "GITHUB_REF_NAME") {
        return "42/merge";
      }

      return "";
    });

    expect(resolveGithubPullRequestNumber()).toBe("42");
  });

  it("does not resolve pull request id from non-numeric GITHUB_REF_NAME merge suffix", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      if (key === "GITHUB_REF_NAME") {
        return "release/merge";
      }

      return "";
    });

    expect(resolveGithubPullRequestNumber()).toBe("");
  });

  it("resolves pull request id from GITHUB_REF merge ref", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_REF: "refs/pull/99/merge",
        GITHUB_REF_NAME: "99",
      };

      return env[key] ?? "";
    });

    expect(resolveGithubPullRequestNumber()).toBe("99");
  });

  it("resolves pull request id from GITHUB_EVENT_PATH for pull_request_target workflows", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_NAME: "main",
        GITHUB_EVENT_PATH: "/tmp/event.json",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockReturnValue(JSON.stringify({ pull_request: { number: 77 } }));

    expect(resolveGithubPullRequestNumber()).toBe("77");
    expect(readFileSync).toHaveBeenCalledWith("/tmp/event.json", "utf-8");
  });

  it("resolves pull request id from top-level event payload number", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_NAME: "main",
        GITHUB_EVENT_PATH: "/tmp/event.json",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockReturnValue(JSON.stringify({ number: 78, pull_request: { title: "Fix things" } }));

    expect(resolveGithubPullRequestNumber()).toBe("78");
  });

  it("enriches ref-based detection with matching title and url from event file", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_REF_NAME: "55/merge",
        GITHUB_EVENT_PATH: "/tmp/event.json",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockReturnValue(
      JSON.stringify({
        pull_request: {
          number: 55,
          title: "Add new feature",
          html_url: "https://github.com/org/repo/pull/55",
        },
      }),
    );

    expect(resolveGithubPullRequestNumber()).toBe("55");
    expect(resolveGithubPullRequestContext()).toEqual({
      number: "55",
      title: "Add new feature",
      url: "https://github.com/org/repo/pull/55",
      headRef: "feature/foo",
      baseRef: "main",
    });
    expect(readFileSync).toHaveBeenCalledWith("/tmp/event.json", "utf-8");
  });

  it("ignores event title when pull request number does not match ref", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_REF_NAME: "55/merge",
        GITHUB_EVENT_PATH: "/tmp/event.json",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockReturnValue(JSON.stringify({ pull_request: { number: 99, title: "Other PR" } }));

    expect(resolveGithubPullRequestContext()).toEqual({
      number: "55",
      headRef: "feature/foo",
      baseRef: "main",
    });
  });

  it("returns empty string when event file is missing", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_EVENT_PATH: "/tmp/missing-event.json",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    expect(resolveGithubPullRequestNumber()).toBe("");
  });

  it("returns empty string when event JSON has no pull request number", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_EVENT_PATH: "/tmp/event.json",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockReturnValue(JSON.stringify({ action: "push" }));

    expect(resolveGithubPullRequestNumber()).toBe("");
  });

  it("resolves pull request id from workflow_run event without head/base env refs", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_EVENT_PATH: "/tmp/event.json",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_NAME: "main",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockReturnValue(
      JSON.stringify({
        workflow_run: {
          event: "pull_request",
          pull_requests: [{ number: 897, head: { ref: "fix/x" }, base: { ref: "main" } }],
        },
      }),
    );

    expect(resolveGithubPullRequestNumber()).toBe("897");
    expect(resolveGithubPullRequestContext()).toEqual({
      number: "897",
      headRef: "fix/x",
      baseRef: "main",
    });
  });

  it("resolves pull request title from GITHUB_EVENT_PATH for pull_request_target workflows", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_NAME: "main",
        GITHUB_EVENT_PATH: "/tmp/event.json",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockReturnValue(
      JSON.stringify({
        pull_request: {
          number: 77,
          title: "Fix things",
          html_url: "https://github.com/org/repo/pull/77",
          head: { ref: "feature/foo" },
          base: { ref: "main" },
        },
      }),
    );

    expect(resolveGithubPullRequestContext()).toEqual({
      number: "77",
      title: "Fix things",
      url: "https://github.com/org/repo/pull/77",
      headRef: "feature/foo",
      baseRef: "main",
    });
  });

  it("resolves merge_group context when HEAD/BASE env refs are unset", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_EVENT_PATH: "/tmp/event.json",
        GITHUB_REF: "refs/heads/gh-readonly-queue/main/pr-42-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        GITHUB_REF_NAME: "gh-readonly-queue/main/pr-42-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockReturnValue(
      JSON.stringify({
        merge_group: {
          head_ref: "refs/heads/gh-readonly-queue/main/pr-42-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          base_ref: "refs/heads/main",
          head_sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          base_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      }),
    );

    expect(resolveGithubPullRequestNumber()).toBe("42");
    expect(resolveGithubPullRequestContext()).toEqual({
      number: "42",
      headRef: "gh-readonly-queue/main/pr-42-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      baseRef: "main",
      headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
  });

  it("parses PR number and base branch from merge queue GITHUB_REF without event file", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_REF: "refs/heads/gh-readonly-queue/release/1.0/pr-99-cccccccccccccccccccccccccccccccccccccccc",
        GITHUB_REF_NAME: "gh-readonly-queue/release/1.0/pr-99-cccccccccccccccccccccccccccccccccccccccc",
      };

      return env[key] ?? "";
    });

    expect(resolveGithubPullRequestContext()).toEqual({
      number: "99",
      headRef: "gh-readonly-queue/release/1.0/pr-99-cccccccccccccccccccccccccccccccccccccccc",
      baseRef: "release/1.0",
    });
  });
});
