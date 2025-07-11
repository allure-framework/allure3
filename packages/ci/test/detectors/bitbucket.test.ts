import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { bitbucket, getJobURL } from "../../src/detectors/bitbucket.js";
import { getEnv } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bitbucket", () => {
  describe("getJobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_GIT_HTTP_ORIGIN") {
          return "https://bitbucket.org/myorg/myrepo";
        }
      });

      expect(getJobURL()).toBe("https://bitbucket.org/myorg/myrepo/pipelines");
    });

    it("should return '/pipelines' when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_GIT_HTTP_ORIGIN") {
          return "";
        }
      });

      expect(getJobURL()).toBe("/pipelines");
    });

    it("should return 'undefined/pipelines' when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_GIT_HTTP_ORIGIN") {
          return undefined;
        }
      });

      expect(getJobURL()).toBe("undefined/pipelines");
    });
  });

  describe("detected", () => {
    it("should be true when BITBUCKET_PIPELINE_UUID is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_PIPELINE_UUID") {
          return "12345-abcde-67890";
        }
      });

      expect(bitbucket.detected).toBe(true);
    });

    it("should be false when BITBUCKET_PIPELINE_UUID is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_PIPELINE_UUID") {
          return "";
        }
      });

      expect(bitbucket.detected).toBe(false);
    });
  });

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_REPO_FULL_NAME") {
          return "myorg/myrepo";
        }
      });

      expect(bitbucket.jobUid).toBe("myorg/myrepo");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_REPO_FULL_NAME") {
          return "";
        }
      });

      expect(bitbucket.jobUid).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_REPO_FULL_NAME") {
          return undefined;
        }
      });

      expect(bitbucket.jobUid).toBe(undefined);
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_GIT_HTTP_ORIGIN") {
          return "https://bitbucket.org/myorg/myrepo";
        }
      });

      expect(bitbucket.jobUrl).toBe("https://bitbucket.org/myorg/myrepo/pipelines");
    });
  });

  describe("jobName", () => {
    it("should return the correct job name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_REPO_FULL_NAME") {
          return "myorg/myrepo";
        }
      });

      expect(bitbucket.jobName).toBe("myorg/myrepo");
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_PIPELINE_UUID") {
          return "12345-abcde-67890";
        }
      });

      expect(bitbucket.jobRunUid).toBe("12345-abcde-67890");
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_GIT_HTTP_ORIGIN") {
          return "https://bitbucket.org/myorg/myrepo";
        }
        if (key === "BITBUCKET_PIPELINE_UUID") {
          return "12345-abcde-67890";
        }
      });

      expect(bitbucket.jobRunUrl).toBe("https://bitbucket.org/myorg/myrepo/pipelines/results/12345-abcde-67890");
    });
  });

  describe("jobRunName", () => {
    it("should return the correct job run name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_PIPELINE_UUID") {
          return "12345-abcde-67890";
        }
      });

      expect(bitbucket.jobRunName).toBe("12345-abcde-67890");
    });
  });

  describe("jobRunBranch", () => {
    it("should return the correct job run branch", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_BRANCH") {
          return "main";
        }
      });

      expect(bitbucket.jobRunBranch).toBe("main");
    });
  });

  describe("pullRequestUrl", () => {
    it("should return the correct pull request URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_PR_ID") {
          return "123";
        }
        if (key === "BITBUCKET_GIT_HTTP_ORIGIN") {
          return "https://bitbucket.org/myorg/myrepo";
        }
      });

      expect(bitbucket.pullRequestUrl).toBe("https://bitbucket.org/myorg/myrepo/pull-requests/123");
    });

    it("should return empty string when BITBUCKET_PR_ID is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_PR_ID") {
          return "";
        }
      });

      expect(bitbucket.pullRequestUrl).toBe("");
    });

    it("should return empty string when BITBUCKET_PR_ID is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_PR_ID") {
          return undefined;
        }
      });

      expect(bitbucket.pullRequestUrl).toBe("");
    });
  });
});
