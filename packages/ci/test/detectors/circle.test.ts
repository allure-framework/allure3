import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { circle, getBuildNumber, getJobRunURL } from "../../src/detectors/circle.js";
import { getEnv, parseURLPath } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
  parseURLPath: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("circle", () => {
  describe("getBuildNumber", () => {
    it("should return the correct build number", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_BUILD_NUM") {
          return "12345";
        }
      });

      expect(getBuildNumber()).toBe("12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_BUILD_NUM") {
          return "";
        }
      });

      expect(getBuildNumber()).toBe("");
    });
  });

  describe("getJobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_BUILD_URL") {
          return "https://circleci.com/gh/myorg/myrepo/12345";
        }
      });

      expect(getJobRunURL()).toBe("https://circleci.com/gh/myorg/myrepo/12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_BUILD_URL") {
          return "";
        }
      });

      expect(getJobRunURL()).toBe("");
    });
  });

  describe("detected", () => {
    it("should be true when CIRCLECI is set and path is not empty", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLECI") {
          return "true";
        }
        if (key === "CIRCLE_BUILD_URL") {
          return "https://circleci.com/gh/myorg/myrepo/12345";
        }
        if (key === "CIRCLE_BUILD_NUM") {
          return "12345";
        }
      });
      (parseURLPath as Mock).mockReturnValue("gh/myorg/myrepo");

      expect(circle.detected).toBe(true);
    });

    it("should be false when CIRCLECI is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLECI") {
          return "";
        }
        if (key === "CIRCLE_BUILD_URL") {
          return "https://circleci.com/gh/myorg/myrepo/12345";
        }
        if (key === "CIRCLE_BUILD_NUM") {
          return "12345";
        }
      });
      (parseURLPath as Mock).mockReturnValue("gh/myorg/myrepo");

      expect(circle.detected).toBe(false);
    });

    it("should be false when path is empty", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLECI") {
          return "true";
        }
        if (key === "CIRCLE_BUILD_URL") {
          return "https://circleci.com/gh/myorg/myrepo/12345";
        }
        if (key === "CIRCLE_BUILD_NUM") {
          return "12345";
        }
      });
      (parseURLPath as Mock).mockReturnValue("");

      expect(circle.detected).toBe(false);
    });
  });

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_BUILD_URL") {
          return "https://circleci.com/gh/myorg/myrepo/12345";
        }
        if (key === "CIRCLE_BUILD_NUM") {
          return "12345";
        }
      });
      (parseURLPath as Mock).mockReturnValue("gh/myorg/myrepo");

      expect(circle.jobUid).toBe("gh/myorg/myrepo");
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_BUILD_URL") {
          return "https://circleci.com/gh/myorg/myrepo/12345";
        }
        if (key === "CIRCLE_BUILD_NUM") {
          return "12345";
        }
      });

      expect(circle.jobUrl).toBe("https://circleci.com/gh/myorg/myrepo");
    });
  });

  describe("jobName", () => {
    it("should return the correct job name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_USERNAME") {
          return "myorg";
        }
        if (key === "CIRCLE_PROJECT_REPONAME") {
          return "myrepo";
        }
      });

      expect(circle.jobName).toBe("myorg/myrepo");
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_WORKFLOW_JOB_ID") {
          return "12345-abcde-67890";
        }
      });

      expect(circle.jobRunUid).toBe("12345-abcde-67890");
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_BUILD_URL") {
          return "https://circleci.com/gh/myorg/myrepo/12345";
        }
      });

      expect(circle.jobRunUrl).toBe("https://circleci.com/gh/myorg/myrepo/12345");
    });
  });

  describe("jobRunName", () => {
    it("should return the correct job run name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_BUILD_NUM") {
          return "12345";
        }
      });

      expect(circle.jobRunName).toBe("12345");
    });
  });

  describe("jobRunBranch", () => {
    it("should return the correct job run branch", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CIRCLE_BRANCH") {
          return "main";
        }
      });

      expect(circle.jobRunBranch).toBe("main");
    });
  });
});
