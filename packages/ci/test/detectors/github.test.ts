import { readFileSync } from "node:fs";

import { story } from "allure-js-commons";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { github } from "../../src/detectors/github.js";
import { getEnv } from "../../src/utils.js";

beforeEach(async () => {
  await story("github");
});

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockEnv = (env: Record<string, string>) => {
  (getEnv as Mock).mockImplementation((key: string) => env[key] ?? "");
};

describe("github", () => {
  describe("detected", () => {
    it("should be true when GITHUB_ACTIONS is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_ACTIONS") {
          return "true";
        }
      });

      expect(github.detected).toBe(true);
    });

    it("should be false when GITHUB_ACTIONS is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_ACTIONS") {
          return "";
        }
      });

      expect(github.detected).toBe(false);
    });
  });

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REPOSITORY") {
          return "myorg/myrepo";
        }
        if (key === "GITHUB_WORKFLOW") {
          return "CI";
        }
      });

      expect(github.jobUid).toBe("myorg/myrepo_CI");
    });

    it("should return '_' when environment variables are not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REPOSITORY" || key === "GITHUB_WORKFLOW") {
          return "";
        }
      });

      expect(github.jobUid).toBe("_");
    });
  });

  describe("repoName", () => {
    it("should extract repository name from full path", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REPOSITORY") {
          return "myorg/myrepo";
        }
      });

      expect(github.repoName).toBe("myrepo");
    });

    it("should return the repository name as-is when no slash present", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REPOSITORY") {
          return "myrepo";
        }
      });

      expect(github.repoName).toBe("myrepo");
    });

    it("should return empty string when GITHUB_REPOSITORY is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REPOSITORY") {
          return "";
        }
      });

      expect(github.repoName).toBe("");
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_SERVER_URL") {
          return "https://github.com";
        }
        if (key === "GITHUB_REPOSITORY") {
          return "myorg/myrepo";
        }
        if (key === "GITHUB_WORKFLOW") {
          return "CI";
        }
      });

      expect(github.jobUrl).toBe("https://github.com/myorg/myrepo/actions?query=workflow%3A%22CI%22");
    });
  });

  describe("jobName", () => {
    it("should return the correct job name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REPOSITORY") {
          return "myorg/myrepo";
        }
        if (key === "GITHUB_WORKFLOW") {
          return "CI";
        }
      });

      expect(github.jobName).toBe("myorg/myrepo - CI");
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_RUN_ID") {
          return "12345";
        }
      });

      expect(github.jobRunUid).toBe("12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_RUN_ID") {
          return "";
        }
      });

      expect(github.jobRunUid).toBe("");
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_SERVER_URL") {
          return "https://github.com";
        }
        if (key === "GITHUB_REPOSITORY") {
          return "myorg/myrepo";
        }
        if (key === "GITHUB_RUN_ID") {
          return "12345";
        }
      });

      expect(github.jobRunUrl).toBe("https://github.com/myorg/myrepo/actions/runs/12345");
    });
  });

  describe("jobRunName", () => {
    it("should return the correct job run name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_JOB") {
          return "build";
        }
        if (key === "GITHUB_RUN_NUMBER") {
          return "42";
        }
      });

      expect(github.jobRunName).toBe("build #42");
    });
  });

  describe("jobRunBranch", () => {
    it("should return branch from GITHUB_HEAD_REF variable when it is set (pull request)", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_HEAD_REF") {
          return "feature-branch";
        }

        if (key === "GITHUB_REF") {
          return "refs/pull/123/merge";
        }
      });

      expect(github.jobRunBranch).toBe("feature-branch");
    });

    it("should return branch name from GITHUB_REF variable when GITHUB_HEAD_REF is not set (regular branch push)", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_HEAD_REF") {
          return "";
        }

        if (key === "GITHUB_REF") {
          return "refs/heads/main";
        }
      });

      expect(github.jobRunBranch).toBe("main");
    });

    it("should strip refs/heads/ prefix from GITHUB_REF variable", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_HEAD_REF") {
          return "";
        }

        if (key === "GITHUB_REF") {
          return "refs/heads/feature-branch";
        }
      });

      expect(github.jobRunBranch).toBe("feature-branch");
    });

    it("should keep slashes in branch names from GITHUB_REF variable", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_HEAD_REF") {
          return "";
        }

        if (key === "GITHUB_REF") {
          return "refs/heads/feature/foo";
        }
      });

      expect(github.jobRunBranch).toBe("feature/foo");
      expect(github.sourceBranch).toBe("feature/foo");
    });

    it("should return empty string when neither environment variable is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_HEAD_REF" || key === "GITHUB_REF") {
          return "";
        }
      });

      expect(github.jobRunBranch).toBe("");
    });

    it("should return empty string for tag refs when ref type is tag", () => {
      mockEnv({
        GITHUB_REF: "refs/tags/v1.0.0",
        GITHUB_REF_NAME: "v1.0.0",
        GITHUB_REF_TYPE: "tag",
      });

      expect(github.jobRunBranch).toBe("");
      expect(github.sourceBranch).toBeUndefined();
    });

    it("should return empty string for tag refs when ref type is unavailable", () => {
      mockEnv({
        GITHUB_REF: "refs/tags/v1.0.0",
        GITHUB_REF_NAME: "v1.0.0",
      });

      expect(github.jobRunBranch).toBe("");
      expect(github.sourceBranch).toBeUndefined();
    });
  });

  describe("pullRequestUrl", () => {
    it("should return the correct pull request URL when ref name has /merge suffix", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REF_NAME") {
          return "123/merge";
        }

        if (key === "GITHUB_SERVER_URL") {
          return "https://github.com";
        }

        if (key === "GITHUB_REPOSITORY") {
          return "myorg/myrepo";
        }
      });

      expect(github.pullRequestUrl).toBe("https://github.com/myorg/myrepo/pull/123");
    });

    it("should return empty string when ref name doesn't have /merge suffix", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REF_NAME") {
          return "main";
        }
      });

      expect(github.pullRequestUrl).toBe("");
    });

    it("should return empty string when branch name ends with /merge", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REF_NAME") {
          return "release/merge";
        }

        return "";
      });

      expect(github.pullRequestUrl).toBe("");
      expect(github.pullRequest).toBeUndefined();
    });

    it("should return empty string when ref name is empty", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REF_NAME") {
          return "";
        }
      });

      expect(github.pullRequestUrl).toBe("");
    });

    it("should resolve pull request URL from GITHUB_EVENT_PATH for pull_request_target workflows", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        const env: Record<string, string> = {
          GITHUB_HEAD_REF: "feature/foo",
          GITHUB_BASE_REF: "main",
          GITHUB_REF: "refs/heads/main",
          GITHUB_REF_NAME: "main",
          GITHUB_EVENT_PATH: "/tmp/event.json",
          GITHUB_SERVER_URL: "https://github.com",
          GITHUB_REPOSITORY: "myorg/myrepo",
        };

        return env[key] ?? "";
      });
      (readFileSync as Mock).mockReturnValue(JSON.stringify({ pull_request: { number: 123 } }));

      expect(github.pullRequestUrl).toBe("https://github.com/myorg/myrepo/pull/123");
    });
  });

  describe("pullRequestName", () => {
    it("should return the pull request name when ref name has /merge suffix", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REF_NAME") {
          return "123/merge";
        }
      });

      expect(github.pullRequestName).toBe("Pull request #123");
    });

    it("should return empty string when ref name doesn't have /merge suffix", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REF_NAME") {
          return "main";
        }
      });

      expect(github.pullRequestName).toBe("");
    });

    it("should return empty string when ref name is empty", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REF_NAME") {
          return "";
        }
      });

      expect(github.pullRequestName).toBe("");
    });

    it("should resolve pull request name from GITHUB_EVENT_PATH for pull_request_target workflows", () => {
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
      (readFileSync as Mock).mockReturnValue(JSON.stringify({ pull_request: { number: 123 } }));

      expect(github.pullRequestName).toBe("Pull request #123");
    });
  });
});
