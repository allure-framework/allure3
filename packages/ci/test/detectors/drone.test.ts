import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { drone, getJobRunUID, getJobRunURL } from "../../src/detectors/drone.js";
import { getEnv } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

describe("drone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getJobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_BUILD_NUMBER") {
          return "12345";
        }
      });

      expect(getJobRunUID()).toBe("12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_BUILD_NUMBER") {
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
        if (key === "CI_BUILD_NUMBER") {
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
        if (key === "CI_BUILD_NUMBER") {
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
  });

  describe("pullRequestUrl", () => {
    it("should return the correct pull request URL for GitHub", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_GITHUB_SERVER") {
          return "https://github.com";
        }

        if (key === "DRONE_REPO_LINK") {
          return "https://github.com/owner/repo";
        }

        if (key === "DRONE_PULL_REQUEST") {
          return "123";
        }
      });

      expect(drone.pullRequestUrl).toBe("https://github.com/owner/repo/pull/123");
    });

    it("should return the correct pull request URL for GitLab", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_GITLAB_SERVER") {
          return "https://gitlab.com";
        }

        if (key === "DRONE_REPO_LINK") {
          return "https://gitlab.com/owner/repo";
        }

        if (key === "DRONE_PULL_REQUEST") {
          return "456";
        }
      });

      expect(drone.pullRequestUrl).toBe("https://gitlab.com/owner/repo/-/merge_requests/456");
    });

    it("should return empty string for other repository providers", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_GITHUB_SERVER") {
          return "https://github.com";
        }

        if (key === "DRONE_GITLAB_SERVER") {
          return "https://gitlab.com";
        }

        if (key === "DRONE_REPO_LINK") {
          return "https://bitbucket.org/owner/repo";
        }

        if (key === "DRONE_PULL_REQUEST") {
          return "789";
        }
      });

      expect(drone.pullRequestUrl).toBe("");
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
