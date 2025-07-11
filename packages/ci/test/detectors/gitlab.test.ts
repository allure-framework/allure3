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

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_ID") {
          return "12345";
        }
      });

      expect(gitlab.jobUID).toBe("12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_ID") {
          return "";
        }
      });

      expect(gitlab.jobUID).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_ID") {
          return undefined;
        }
      });

      expect(gitlab.jobUID).toBe(undefined);
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_URL") {
          return "https://gitlab.com/myorg/myrepo";
        }
      });

      expect(gitlab.jobURL).toBe("https://gitlab.com/myorg/myrepo/pipelines");
    });

    it("should return '/pipelines' when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_URL") {
          return "";
        }
      });

      expect(gitlab.jobURL).toBe("/pipelines");
    });

    it("should return 'undefined/pipelines' when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_URL") {
          return undefined;
        }
      });

      expect(gitlab.jobURL).toBe("undefined/pipelines");
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

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_NAME") {
          return undefined;
        }
      });

      expect(gitlab.jobName).toBe(undefined);
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return "67890";
        }
      });

      expect(gitlab.jobRunUID).toBe("67890");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return "";
        }
      });

      expect(gitlab.jobRunUID).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return undefined;
        }
      });

      expect(gitlab.jobRunUID).toBe(undefined);
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_URL") {
          return "https://gitlab.com/myorg/myrepo/-/pipelines/67890";
        }
      });

      expect(gitlab.jobRunURL).toBe("https://gitlab.com/myorg/myrepo/-/pipelines/67890");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_URL") {
          return "";
        }
      });

      expect(gitlab.jobRunURL).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_URL") {
          return undefined;
        }
      });

      expect(gitlab.jobRunURL).toBe(undefined);
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

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return undefined;
        }
      });

      expect(gitlab.jobRunName).toBe(undefined);
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

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_COMMIT_REF_NAME") {
          return undefined;
        }
      });

      expect(gitlab.jobRunBranch).toBe(undefined);
    });
  });
});
