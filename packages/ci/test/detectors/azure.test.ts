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

  describe("repoName", () => {
    it("should extract repository name from full path", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_REPOSITORY_NAME") {
          return "myorg/myrepo";
        }
      });

      expect(azure.repoName).toBe("myrepo");
    });

    it("should return the repository name as-is when no slash present", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_REPOSITORY_NAME") {
          return "myrepo";
        }
      });

      expect(azure.repoName).toBe("myrepo");
    });

    it("should return empty string when BUILD_REPOSITORY_NAME is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_REPOSITORY_NAME") {
          return "";
        }
      });

      expect(azure.repoName).toBe("");
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

      expect(azure.jobUid).toBe("project123_67890");
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

      expect(azure.jobUrl).toBe("https://dev.azure.com/organization/project123/_build?definitionId=67890");
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

      expect(azure.jobRunUid).toBe("12345");
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

      expect(azure.jobRunUrl).toBe("https://dev.azure.com/organization/project123/_build/results?buildId=12345");
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

  describe("pullRequestUrl", () => {
    it("should return the correct pull request URL for GitHub", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_REPOSITORY_PROVIDER") {
          return "GitHub";
        }

        if (key === "SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI") {
          return "https://github.com/owner/repo";
        }

        if (key === "SYSTEM_PULLREQUEST_PULLREQUESTNUMBER") {
          return "123";
        }
      });

      expect(azure.pullRequestUrl).toBe("https://github.com/owner/repo/pull/123");
    });

    it("should return the correct pull request URL for TfsGit", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_REPOSITORY_PROVIDER") {
          return "TfsGit";
        }

        if (key === "SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI") {
          return "https://dev.azure.com/organization/project/_git/repo";
        }

        if (key === "SYSTEM_PULLREQUEST_PULLREQUESTNUMBER") {
          return "456";
        }
      });

      expect(azure.pullRequestUrl).toBe("https://dev.azure.com/organization/project/_git/repo/pullrequest/456");
    });

    it("should return the correct pull request URL for TfsVersionControl", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_REPOSITORY_PROVIDER") {
          return "TfsVersionControl";
        }

        if (key === "SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI") {
          return "https://dev.azure.com/organization/project/_git/repo";
        }

        if (key === "SYSTEM_PULLREQUEST_PULLREQUESTNUMBER") {
          return "789";
        }
      });

      expect(azure.pullRequestUrl).toBe("https://dev.azure.com/organization/project/_git/repo/pullrequest/789");
    });

    it("should return empty string for other repository providers", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_REPOSITORY_PROVIDER") {
          return "OtherProvider";
        }

        if (key === "SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI") {
          return "https://example.com/repo";
        }

        if (key === "SYSTEM_PULLREQUEST_PULLREQUESTNUMBER") {
          return "123";
        }
      });

      expect(azure.pullRequestUrl).toBe("");
    });

    it("should return empty string when environment variables are not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "BUILD_REPOSITORY_PROVIDER") {
          return "";
        }

        if (key === "SYSTEM_PULLREQUEST_SOURCEREPOSITORYURI") {
          return "";
        }

        if (key === "SYSTEM_PULLREQUEST_PULLREQUESTNUMBER") {
          return "";
        }
      });

      expect(azure.pullRequestUrl).toBe("");
    });
  });
});
