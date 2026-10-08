import { readFileSync } from "node:fs";

import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

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
  it("returns head and base refs from pull_request payload", () => {
    expect(
      parsePullRequestContextFromEventJson(
        JSON.stringify({
          pull_request: {
            number: 12,
            head: { ref: "feature/foo" },
            base: { ref: "main" },
          },
        }),
      ),
    ).toEqual({
      number: "12",
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

  it("does not read event file when ref-based detection succeeds", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_REF_NAME: "55/merge",
        GITHUB_EVENT_PATH: "/tmp/event.json",
      };

      return env[key] ?? "";
    });

    expect(resolveGithubPullRequestNumber()).toBe("55");
    expect(readFileSync).not.toHaveBeenCalled();
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
});
