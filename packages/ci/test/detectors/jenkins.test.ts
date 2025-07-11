import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { jenkins } from "../../src/detectors/jenkins.js";
import { getEnv } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_NAME") {
          return "my-jenkins-job";
        }
      });

      expect(jenkins.jobUID).toBe("my-jenkins-job");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_NAME") {
          return "";
        }
      });

      expect(jenkins.jobUID).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_NAME") {
          return undefined;
        }
      });

      expect(jenkins.jobUID).toBe(undefined);
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_URL") {
          return "https://jenkins.example.com/job/my-jenkins-job";
        }
      });

      expect(jenkins.jobURL).toBe("https://jenkins.example.com/job/my-jenkins-job");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_URL") {
          return "";
        }
      });

      expect(jenkins.jobURL).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_URL") {
          return undefined;
        }
      });

      expect(jenkins.jobURL).toBe(undefined);
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

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "JOB_BASE_NAME") {
          return undefined;
        }
      });

      expect(jenkins.jobName).toBe(undefined);
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_NUMBER") {
          return "42";
        }
      });

      expect(jenkins.jobRunUID).toBe("42");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_NUMBER") {
          return "";
        }
      });

      expect(jenkins.jobRunUID).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_NUMBER") {
          return undefined;
        }
      });

      expect(jenkins.jobRunUID).toBe(undefined);
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_URL") {
          return "https://jenkins.example.com/job/my-jenkins-job/42";
        }
      });

      expect(jenkins.jobRunURL).toBe("https://jenkins.example.com/job/my-jenkins-job/42");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_URL") {
          return "";
        }
      });

      expect(jenkins.jobRunURL).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_URL") {
          return undefined;
        }
      });

      expect(jenkins.jobRunURL).toBe(undefined);
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

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_DISPLAY_NAME") {
          return undefined;
        }
      });

      expect(jenkins.jobRunName).toBe(undefined);
    });
  });

  describe("jobRunBranch", () => {
    it("should return an empty string", () => {
      expect(jenkins.jobRunBranch).toBe("");
    });
  });
});
