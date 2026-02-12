import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { gitlab } from "../../src/detectors/gitlab.js";
import { getEnv } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gitlab", () => {
  describe("detected", () => {
    it("should be true when GITLAB_CI is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITLAB_CI") {
          return "true";
        }
      });

      expect(gitlab.detected).toBe(true);
    });

    it("should be false when GITLAB_CI is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GITLAB_CI") {
          return "";
        }
      });

      expect(gitlab.detected).toBe(false);
    });
  });

  describe("repoName", () => {
    it("should return repository name when CI_PROJECT_NAME is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_NAME") {
          return "myrepo";
        }
      });

      expect(gitlab.repoName).toBe("myrepo");
    });

    it("should return empty string when CI_PROJECT_NAME is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_NAME") {
          return "";
        }
      });

      expect(gitlab.repoName).toBe("");
    });
  });

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_ID") {
          return "12345";
        }
      });

      expect(gitlab.jobUid).toBe("12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_ID") {
          return "";
        }
      });

      expect(gitlab.jobUid).toBe("");
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_URL") {
          return "https://gitlab.com/myorg/myrepo";
        }
      });

      expect(gitlab.jobUrl).toBe("https://gitlab.com/myorg/myrepo/pipelines");
    });

    it("should return '/pipelines' when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_URL") {
          return "";
        }
      });

      expect(gitlab.jobUrl).toBe("/pipelines");
    });
  });

  describe("jobName", () => {
    it("should return the correct job name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_NAME") {
          return "myrepo";
        }
      });

      expect(gitlab.jobName).toBe("myrepo");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_NAME") {
          return "";
        }
      });

      expect(gitlab.jobName).toBe("");
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return "67890";
        }
      });

      expect(gitlab.jobRunUid).toBe("67890");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return "";
        }
      });

      expect(gitlab.jobRunUid).toBe("");
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_URL") {
          return "https://gitlab.com/myorg/myrepo/-/pipelines/67890";
        }
      });

      expect(gitlab.jobRunUrl).toBe("https://gitlab.com/myorg/myrepo/-/pipelines/67890");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_URL") {
          return "";
        }
      });

      expect(gitlab.jobRunUrl).toBe("");
    });
  });

  describe("jobRunName", () => {
    it("should return the correct job run name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return "67890";
        }
      });

      expect(gitlab.jobRunName).toBe("67890");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return "";
        }
      });

      expect(gitlab.jobRunName).toBe("");
    });
  });

  describe("jobRunBranch", () => {
    it("should return the correct job run branch", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_COMMIT_REF_NAME") {
          return "main";
        }
      });

      expect(gitlab.jobRunBranch).toBe("main");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_COMMIT_REF_NAME") {
          return "";
        }
      });

      expect(gitlab.jobRunBranch).toBe("");
    });
  });

  describe("pullRequestUrl", () => {
    it("should return the correct pull request URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_MERGE_REQUEST_IID") {
          return "123";
        }

        if (key === "CI_PROJECT_URL") {
          return "https://gitlab.com/myorg/myrepo";
        }
      });

      expect(gitlab.pullRequestUrl).toBe("https://gitlab.com/myorg/myrepo/-/merge_requests/123");
    });

    it("should return empty string when CI_MERGE_REQUEST_IID is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_MERGE_REQUEST_IID") {
          return "";
        }
      });

      expect(gitlab.pullRequestUrl).toBe("");
    });

    it("should handle custom GitLab instance hosts", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_MERGE_REQUEST_IID") {
          return "123";
        }

        if (key === "CI_PROJECT_URL") {
          return "https://gitlab.example.com/myorg/myrepo";
        }
      });

      expect(gitlab.pullRequestUrl).toBe("https://gitlab.example.com/myorg/myrepo/-/merge_requests/123");
    });
  });
});
