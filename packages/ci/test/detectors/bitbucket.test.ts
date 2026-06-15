import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { bitbucket, getJobURL } from "../../src/detectors/bitbucket.js";
import { getEnv } from "../../src/utils.js";

beforeEach(async () => {
  await story("bitbucket");
});
vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockEnv = (vars: Record<string, string>) => {
  (getEnv as Mock).mockImplementation((key: string) => vars[key] ?? "");
};

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

  describe("repoName", () => {
    it("should return repository name when BITBUCKET_REPO_SLUG is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_REPO_SLUG") {
          return "myrepo";
        }
      });

      expect(bitbucket.repoName).toBe("myrepo");
    });

    it("should return empty string when BITBUCKET_REPO_SLUG is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BITBUCKET_REPO_SLUG") {
          return "";
        }
      });

      expect(bitbucket.repoName).toBe("");
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
  });

  describe("git fields", () => {
    it("should normalize repository URLs from BITBUCKET_GIT_HTTP_ORIGIN", () => {
      mockEnv({
        BITBUCKET_REPO_FULL_NAME: "myorg/myrepo",
        BITBUCKET_GIT_HTTP_ORIGIN: " https://x-token-auth:secret@bitbucket.org/myorg/myrepo.git/ ",
        BITBUCKET_PR_ID: "123",
      });

      expect(bitbucket.repository).toEqual({
        slug: "myorg/myrepo",
        url: "https://bitbucket.org/myorg/myrepo",
      });
      expect(bitbucket.pullRequestUrl).toBe("https://bitbucket.org/myorg/myrepo/pull-requests/123");
    });

    it("should not map tag builds to branch fields", () => {
      mockEnv({
        BITBUCKET_TAG: "v1.0.0",
      });

      expect(bitbucket.jobRunBranch).toBe("");
      expect(bitbucket.sourceBranch).toBeUndefined();
    });
  });
});
