import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { drone, getJobRunUID, getJobRunURL } from "../../src/detectors/drone.js";
import { getEnv } from "../../src/utils.js";

beforeEach(async () => {
  await story("drone");
});
vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const mockEnv = (env: Record<string, string>) => {
  (getEnv as Mock).mockImplementation((key: string) => env[key] ?? "");
};

describe("drone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getJobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BUILD_NUMBER") {
          return "12345";
        }
      });

      expect(getJobRunUID()).toBe("12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BUILD_NUMBER") {
          return "";
        }
      });

      expect(getJobRunUID()).toBe("");
    });
  });

  describe("getJobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BUILD_LINK") {
          return "https://drone.example.com/myorg/myrepo/12345";
        }
      });

      expect(getJobRunURL()).toBe("https://drone.example.com/myorg/myrepo/12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BUILD_LINK") {
          return "";
        }
      });

      expect(getJobRunURL()).toBe("");
    });
  });

  describe("detected", () => {
    it("should be true when DRONE_SYSTEM_HOST is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_SYSTEM_HOST") {
          return "drone.example.com";
        }
      });

      expect(drone.detected).toBe(true);
    });

    it("should be false when DRONE_SYSTEM_HOST is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_SYSTEM_HOST") {
          return "";
        }
      });

      expect(drone.detected).toBe(false);
    });
  });

  describe("repoName", () => {
    it("should return repository name when DRONE_REPO_NAME is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_REPO_NAME") {
          return "myrepo";
        }
      });

      expect(drone.repoName).toBe("myrepo");
    });

    it("should return empty string when DRONE_REPO_NAME is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_REPO_NAME") {
          return "";
        }
      });

      expect(drone.repoName).toBe("");
    });
  });

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_REPO") {
          return "myorg/myrepo";
        }
      });

      expect(drone.jobUid).toBe("myorg/myrepo");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_REPO") {
          return "";
        }
      });

      expect(drone.jobUid).toBe("");
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BUILD_LINK") {
          return "https://drone.example.com/myorg/myrepo/12345";
        }
        if (key === "DRONE_BUILD_NUMBER") {
          return "12345";
        }
      });

      expect(drone.jobUrl).toBe("https://drone.example.com/myorg/myrepo/");
    });
  });

  describe("jobName", () => {
    it("should return the correct job name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_REPO") {
          return "myorg/myrepo";
        }
      });

      expect(drone.jobName).toBe("myorg/myrepo");
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BUILD_NUMBER") {
          return "12345";
        }
      });

      expect(drone.jobRunUid).toBe("12345");
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BUILD_LINK") {
          return "https://drone.example.com/myorg/myrepo/12345";
        }
      });

      expect(drone.jobRunUrl).toBe("https://drone.example.com/myorg/myrepo/12345");
    });
  });

  describe("jobRunName", () => {
    it("should return the correct job run name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BUILD_NUMBER") {
          return "12345";
        }
      });

      expect(drone.jobRunName).toBe("12345");
    });
  });

  describe("jobRunBranch", () => {
    it("should return the correct job run branch", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BRANCH") {
          return "main";
        }
      });

      expect(drone.jobRunBranch).toBe("main");
    });

    it("should return empty string for tag builds", () => {
      mockEnv({
        DRONE_BRANCH: "v1.0.0",
        DRONE_TAG: "v1.0.0",
      });

      expect(drone.jobRunBranch).toBe("");
    });
  });

  describe("pullRequestUrl", () => {
    it("should return the correct pull request URL for GitHub from repository link", () => {
      mockEnv({
        DRONE_REPO_LINK: "https://github.com/owner/repo",
        DRONE_PULL_REQUEST: "123",
      });

      expect(drone.pullRequestUrl).toBe("https://github.com/owner/repo/pull/123");
    });

    it("should return the correct pull request URL for GitLab from repository link", () => {
      mockEnv({
        DRONE_REPO_LINK: "https://gitlab.com/owner/repo",
        DRONE_PULL_REQUEST: "456",
      });

      expect(drone.pullRequestUrl).toBe("https://gitlab.com/owner/repo/-/merge_requests/456");
    });

    it("should return the correct pull request URL for Bitbucket from repository link", () => {
      mockEnv({
        DRONE_REPO_LINK: "https://bitbucket.org/owner/repo",
        DRONE_PULL_REQUEST: "789",
      });

      expect(drone.pullRequestUrl).toBe("https://bitbucket.org/owner/repo/pull-requests/789");
    });

    it("should return empty string for unsupported repository providers", () => {
      mockEnv({
        DRONE_REPO_LINK: "https://example.com/owner/repo",
        DRONE_PULL_REQUEST: "789",
      });

      expect(drone.pullRequestUrl).toBe("");
    });
  });

  describe("sourceBranch", () => {
    it("should return the source branch for pull requests", () => {
      mockEnv({
        DRONE_PULL_REQUEST: "123",
        DRONE_SOURCE_BRANCH: "feature/foo",
        DRONE_BRANCH: "main",
      });

      expect(drone.sourceBranch).toBe("feature/foo");
    });

    it("should return undefined when pull request source branch is unavailable", () => {
      mockEnv({
        DRONE_PULL_REQUEST: "123",
        DRONE_BRANCH: "main",
      });

      expect(drone.sourceBranch).toBeUndefined();
    });

    it("should return the branch for push builds", () => {
      mockEnv({
        DRONE_BRANCH: "feature/foo",
      });

      expect(drone.sourceBranch).toBe("feature/foo");
    });

    it("should return undefined for tag builds", () => {
      mockEnv({
        DRONE_BRANCH: "v1.0.0",
        DRONE_TAG: "v1.0.0",
      });

      expect(drone.sourceBranch).toBeUndefined();
    });
  });

  describe("targetBranch", () => {
    it("should return the target branch for pull requests", () => {
      mockEnv({
        DRONE_PULL_REQUEST: "123",
        DRONE_BRANCH: "main",
        DRONE_TARGET_BRANCH: "main",
      });

      expect(drone.targetBranch).toBe("main");
    });

    it("should fall back to DRONE_BRANCH for pull request target branch", () => {
      mockEnv({
        DRONE_PULL_REQUEST: "123",
        DRONE_BRANCH: "main",
      });

      expect(drone.targetBranch).toBe("main");
    });

    it("should return undefined for tag builds", () => {
      mockEnv({
        DRONE_BRANCH: "v1.0.0",
        DRONE_TARGET_BRANCH: "v1.0.0",
        DRONE_TAG: "v1.0.0",
      });

      expect(drone.targetBranch).toBeUndefined();
    });
  });

  describe("pullRequestName", () => {
    it("should return the correct pull request name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_PULL_REQUEST_TITLE") {
          return "Add new feature";
        }
      });

      expect(drone.pullRequestName).toBe("Add new feature");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_PULL_REQUEST_TITLE") {
          return "";
        }
      });

      expect(drone.pullRequestName).toBe("");
    });
  });
});
