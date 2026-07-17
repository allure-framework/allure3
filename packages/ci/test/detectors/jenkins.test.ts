import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { jenkins } from "../../src/detectors/jenkins.js";
import { getEnv } from "../../src/utils.js";

beforeEach(async () => {
  await story("jenkins");
});
vi.mock("../../src/utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/utils.js")>();

  return {
    ...actual,
    getEnv: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

const mockEnv = (env: Record<string, string>) => {
  (getEnv as Mock).mockImplementation((key: string) => env[key] ?? "");
};

describe("jenkins", () => {
  describe("detected", () => {
    it("should be true when JENKINS_URL is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JENKINS_URL") {
          return "https://jenkins.example.com";
        }
      });

      expect(jenkins.detected).toBe(true);
    });

    it("should be false when JENKINS_URL is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JENKINS_URL") {
          return "";
        }
      });

      expect(jenkins.detected).toBe(false);
    });
  });

  describe("repoName", () => {
    it("should extract repository name from git url", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GIT_URL") {
          return "https://github.com/owner/myrepo.git";
        }
      });

      expect(jenkins.repoName).toBe("myrepo");
    });

    it("should return empty string when unable to extract repository name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GIT_URL") {
          return "invalid-url";
        }
      });

      expect(jenkins.repoName).toBe("");
    });

    it("should return empty string when GIT_URL is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "GIT_URL") {
          return "";
        }
      });

      expect(jenkins.repoName).toBe("");
    });
  });

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_NAME") {
          return "my-jenkins-job";
        }
      });

      expect(jenkins.jobUid).toBe("my-jenkins-job");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_NAME") {
          return "";
        }
      });

      expect(jenkins.jobUid).toBe("");
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_URL") {
          return "https://jenkins.example.com/job/my-jenkins-job";
        }
      });

      expect(jenkins.jobUrl).toBe("https://jenkins.example.com/job/my-jenkins-job");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_URL") {
          return "";
        }
      });

      expect(jenkins.jobUrl).toBe("");
    });
  });

  describe("jobName", () => {
    it("should return the correct job name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_BASE_NAME") {
          return "my-jenkins-job";
        }
      });

      expect(jenkins.jobName).toBe("my-jenkins-job");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_BASE_NAME") {
          return "";
        }
      });

      expect(jenkins.jobName).toBe("");
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_NUMBER") {
          return "42";
        }
      });

      expect(jenkins.jobRunUid).toBe("42");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_NUMBER") {
          return "";
        }
      });

      expect(jenkins.jobRunUid).toBe("");
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_URL") {
          return "https://jenkins.example.com/job/my-jenkins-job/42";
        }
      });

      expect(jenkins.jobRunUrl).toBe("https://jenkins.example.com/job/my-jenkins-job/42");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_URL") {
          return "";
        }
      });

      expect(jenkins.jobRunUrl).toBe("");
    });
  });

  describe("jobRunName", () => {
    it("should return the correct job run name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_DISPLAY_NAME") {
          return "#42";
        }
      });

      expect(jenkins.jobRunName).toBe("#42");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_DISPLAY_NAME") {
          return "";
        }
      });

      expect(jenkins.jobRunName).toBe("");
    });
  });

  describe("jobRunBranch", () => {
    it("should return the correct branch name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BRANCH_NAME") {
          return "feature/my-branch";
        }
      });

      expect(jenkins.jobRunBranch).toBe("feature/my-branch");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BRANCH_NAME") {
          return "";
        }
      });

      expect(jenkins.jobRunBranch).toBe("");
    });

    it("should fall back to GIT_LOCAL_BRANCH", () => {
      mockEnv({
        GIT_BRANCH: "origin/feature/my-branch",
        GIT_LOCAL_BRANCH: "feature/my-branch",
      });

      expect(jenkins.jobRunBranch).toBe("feature/my-branch");
    });

    it("should normalize remote-prefixed GIT_BRANCH", () => {
      mockEnv({
        GIT_BRANCH: "origin/feature/my-branch",
      });

      expect(jenkins.jobRunBranch).toBe("feature/my-branch");
    });

    it("should return empty string for tag builds", () => {
      mockEnv({
        BRANCH_NAME: "v1.0.0",
        TAG_NAME: "v1.0.0",
      });

      expect(jenkins.jobRunBranch).toBe("");
    });
  });

  describe("sourceBranch", () => {
    it("should prefer pull request source branch", () => {
      mockEnv({
        BRANCH_NAME: "PR-123",
        CHANGE_BRANCH: "feature/my-branch",
      });

      expect(jenkins.sourceBranch).toBe("feature/my-branch");
    });

    it("should fall back to Git plugin branch", () => {
      mockEnv({
        GIT_BRANCH: "origin/feature/my-branch",
      });

      expect(jenkins.sourceBranch).toBe("feature/my-branch");
    });

    it("should return undefined for tag builds", () => {
      mockEnv({
        BRANCH_NAME: "v1.0.0",
        GIT_BRANCH: "origin/v1.0.0",
        TAG_NAME: "v1.0.0",
      });

      expect(jenkins.sourceBranch).toBeUndefined();
    });
  });

  describe("targetBranch", () => {
    it("should return undefined for tag builds", () => {
      mockEnv({
        CHANGE_TARGET: "main",
        TAG_NAME: "v1.0.0",
      });

      expect(jenkins.targetBranch).toBeUndefined();
    });
  });

  describe("pullRequestUrl", () => {
    it("should return the correct pull request URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CHANGE_URL") {
          return "https://github.com/owner/repo/pull/123";
        }
      });

      expect(jenkins.pullRequestUrl).toBe("https://github.com/owner/repo/pull/123");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CHANGE_URL") {
          return "";
        }
      });

      expect(jenkins.pullRequestUrl).toBe("");
    });
  });

  describe("pullRequestName", () => {
    it("should return the correct pull request name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CHANGE_TITLE") {
          return "Add new feature";
        }
      });

      expect(jenkins.pullRequestName).toBe("Add new feature");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CHANGE_TITLE") {
          return "";
        }
      });

      expect(jenkins.pullRequestName).toBe("");
    });
  });
});
