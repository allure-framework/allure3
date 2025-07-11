import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { azure, getBuildID, getDefinitionID, getProjectID, getRootURL } from "../../src/detectors/azure.js";
import { getEnv } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("azure", () => {
  describe("getRootURL", () => {
    it("should return the correct root URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_COLLECTIONURI") {
          return "https://dev.azure.com/organization";
        }
      });

      expect(getRootURL()).toBe("https://dev.azure.com/organization");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_COLLECTIONURI") {
          return "";
        }
      });

      expect(getRootURL()).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_COLLECTIONURI") {
          return undefined;
        }
      });

      expect(getRootURL()).toBe(undefined);
    });
  });

  describe("getBuildID", () => {
    it("should return the correct build ID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_BUILDID") {
          return "12345";
        }
      });

      expect(getBuildID()).toBe("12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_BUILDID") {
          return "";
        }
      });

      expect(getBuildID()).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_BUILDID") {
          return undefined;
        }
      });

      expect(getBuildID()).toBe(undefined);
    });
  });

  describe("getDefinitionID", () => {
    it("should return the correct definition ID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_DEFINITIONID") {
          return "67890";
        }
      });

      expect(getDefinitionID()).toBe("67890");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_DEFINITIONID") {
          return "";
        }
      });

      expect(getDefinitionID()).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_DEFINITIONID") {
          return undefined;
        }
      });

      expect(getDefinitionID()).toBe(undefined);
    });
  });

  describe("getProjectID", () => {
    it("should return the correct project ID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_TEAMPROJECTID") {
          return "project123";
        }
      });

      expect(getProjectID()).toBe("project123");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_TEAMPROJECTID") {
          return "";
        }
      });

      expect(getProjectID()).toBe("");
    });

    it("should return undefined when environment variable is undefined", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_TEAMPROJECTID") {
          return undefined;
        }
      });

      expect(getProjectID()).toBe(undefined);
    });
  });

  describe("detected", () => {
    it("should be true when SYSTEM_DEFINITIONID is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_DEFINITIONID") {
          return "67890";
        }
      });

      expect(azure.detected).toBe(true);
    });

    it("should be false when SYSTEM_DEFINITIONID is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_DEFINITIONID") {
          return "";
        }
      });

      expect(azure.detected).toBe(false);
    });
  });

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_TEAMPROJECTID") {
          return "project123";
        }

        if (key === "SYSTEM_DEFINITIONID") {
          return "67890";
        }
      });

      expect(azure.jobUID).toBe("project123_67890");
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_COLLECTIONURI") {
          return "https://dev.azure.com/organization";
        }

        if (key === "SYSTEM_TEAMPROJECTID") {
          return "project123";
        }

        if (key === "SYSTEM_DEFINITIONID") {
          return "67890";
        }
      });

      expect(azure.jobURL).toBe("https://dev.azure.com/organization/project123/_build?definitionId=67890");
    });
  });

  describe("jobName", () => {
    it("should return the correct job name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_DEFINITIONNAME") {
          return "My Azure Build";
        }
      });

      expect(azure.jobName).toBe("My Azure Build");
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_BUILDID") {
          return "12345";
        }
      });

      expect(azure.jobRunUID).toBe("12345");
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "SYSTEM_COLLECTIONURI") {
          return "https://dev.azure.com/organization";
        }

        if (key === "SYSTEM_TEAMPROJECTID") {
          return "project123";
        }

        if (key === "BUILD_BUILDID") {
          return "12345";
        }
      });

      expect(azure.jobRunURL).toBe("https://dev.azure.com/organization/project123/_build/results?buildId=12345");
    });
  });

  describe("jobRunName", () => {
    it("should return the correct job run name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_BUILDNUMBER") {
          return "20230711.1";
        }
      });

      expect(azure.jobRunName).toBe("20230711.1");
    });
  });

  describe("jobRunBranch", () => {
    it("should return the correct job run branch", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_SOURCEBRANCHNAME") {
          return "main";
        }
      });

      expect(azure.jobRunBranch).toBe("main");
    });
  });
});
