import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { drone, getJobRunUID, getJobRunURL } from "../../src/detectors/drone.js";
import { getEnv } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("drone", () => {
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

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_BUILD_NUMBER") {
          return undefined;
        }
      });

      expect(getJobRunUID()).toBe(undefined);
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

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_BUILD_LINK") {
          return undefined;
        }
      });

      expect(getJobRunURL()).toBe(undefined);
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

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "DRONE_REPO") {
          return undefined;
        }
      });

      expect(drone.jobUid).toBe(undefined);
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
});
