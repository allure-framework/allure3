import { readFileSync } from "node:fs";

import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { parsePullRequestNumberFromEventJson, resolveGithubPullRequestNumber } from "../src/helpers/github.js";
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

  it("returns empty string for invalid JSON", () => {
    expect(parsePullRequestNumberFromEventJson("{not-json")).toBe("");
  });

  it("returns empty string when pull_request is missing", () => {
    expect(parsePullRequestNumberFromEventJson(JSON.stringify({ action: "opened" }))).toBe("");
  });

  it("returns empty string when pull_request.number is missing", () => {
    expect(parsePullRequestNumberFromEventJson(JSON.stringify({ pull_request: { title: "No number" } }))).toBe("");
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

  it("returns empty string when only one of head/base refs is set", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      if (key === "GITHUB_HEAD_REF") {
        return "feature/foo";
      }

      if (key === "GITHUB_EVENT_PATH") {
        return "/tmp/event.json";
      }

      return "";
    });
    (readFileSync as Mock).mockReturnValue(JSON.stringify({ pull_request: { number: 77 } }));

    expect(resolveGithubPullRequestNumber()).toBe("");
    expect(readFileSync).not.toHaveBeenCalled();
  });
});
