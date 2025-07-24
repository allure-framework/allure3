import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { github } from "../../src/detectors/github.js";
import { getEnv } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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
    it("should return the correct job run branch", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REF") {
          return "refs/heads/main";
        }
      });

      expect(github.jobRunBranch).toBe("refs/heads/main");
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

    it("should return empty string when ref name is empty", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITHUB_REF_NAME") {
          return "";
        }
      });

      expect(github.pullRequestUrl).toBe("");
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
  })
});
