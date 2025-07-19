import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { amazon, getPipelineName, isBatchBuild, parseArnValues } from "../../src/detectors/amazon.js";
import { getEnv } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("amazon", () => {
  describe("parseArnValues", () => {
    it("should parse the correct arn values", () => {
      const arn = "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
      const values = parseArnValues(arn);

      expect(values).toEqual(["us-east-1", "123456789012", "my-project", "1234567890"]);
    });

    it("should return empty array for invalid ARN format", () => {
      const arn = "invalid-arn-format";
      const values = parseArnValues(arn);

      expect(values).toEqual([]);
    });

    it("should return empty array for empty string", () => {
      const arn = "";
      const values = parseArnValues(arn);

      expect(values).toEqual([]);
    });

    it("should return empty array for undefined", () => {
      const values = parseArnValues(undefined as any);

      expect(values).toEqual([]);
    });
  });

  describe("isBatchBuild", () => {
    it("should be true for batch build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_BATCH_TRIGGERED") {
          return "true";
        }
      });

      expect(isBatchBuild()).toBe(true);
    });

    it("should be false for non-batch build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_BATCH_TRIGGERED") {
          return "false";
        }
      });

      expect(isBatchBuild()).toBe(false);
    });

    it("should be false for empty string", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_BATCH_TRIGGERED") {
          return "";
        }
      });

      expect(isBatchBuild()).toBe(false);
    });
  });

  describe("getPipelineName", () => {
    it("should return the correct pipeline name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_INITIATOR") {
          return "codepipeline/my-pipeline";
        }
      });

      expect(getPipelineName()).toBe("my-pipeline");
    });

    it("should return empty string when initiator is not a pipeline", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_INITIATOR") {
          return "some-other-initiator";
        }
      });

      expect(getPipelineName()).toBe("");
    });

    it("should return empty string when initiator is empty", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_INITIATOR") {
          return "";
        }
      });

      expect(getPipelineName()).toBe("");
    });
  });

  describe("detected", () => {
    it("should be true for amazon build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
        }
      });

      expect(amazon.detected).toBe(true);
    });

    it("should be false for when there is no arn values", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1";
        }
      });

      expect(amazon.detected).toBe(false);
    });

    it("should be false for when there is no CODEBUILD_BUILD_ARN env variable", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "";
        }
      });

      expect(amazon.detected).toBe(false);
    });
  });

  describe("jobUID", () => {
    it("should return build/project for regular build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
        }

        if (key === "CODEBUILD_BUILD_BATCH_TRIGGERED") {
          return "false";
        }

        if (key === "CODEBUILD_INITIATOR") {
          return "";
        }
      });

      expect(amazon.jobUid).toBe("build/my-project");
    });

    it("should return buildbatch/project for batch build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-batch:abcdef";
        }

        if (key === "CODEBUILD_BUILD_BATCH_TRIGGERED") {
          return "true";
        }

        if (key === "CODEBUILD_INITIATOR") {
          return "";
        }
      });

      expect(amazon.jobUid).toBe("buildbatch/my-batch");
    });

    it("should return pipeline/pipelineName for pipeline build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-pipeline:abcdef";
        }

        if (key === "CODEBUILD_INITIATOR") {
          return "codepipeline/my-pipeline";
        }
      });

      expect(amazon.jobUid).toBe("pipeline/my-pipeline");
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
        }
      });

      expect(amazon.jobUrl).toBe(
        "https://console.aws.amazon.com/codebuild/home?region=us-east-1#/projects/my-project/view/new",
      );
    });

    it("should return the correct job URL for pipeline build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-pipeline:abcdef";
        }

        if (key === "CODEBUILD_INITIATOR") {
          return "codepipeline/my-pipeline";
        }
      });

      expect(amazon.jobUrl).toBe(
        "https://console.aws.amazon.com/codesuite/codepipeline/pipelines/my-pipeline/view?region=us-east-1",
      );
    });
  });

  describe("jobName", () => {
    it("should return the correct job name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
        }
      });

      expect(amazon.jobName).toBe("my-project");
    });

    it("should return the correct job name for pipeline build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-pipeline:abcdef";
        }

        if (key === "CODEBUILD_INITIATOR") {
          return "codepipeline/my-pipeline";
        }
      });

      expect(amazon.jobName).toBe("my-pipeline");
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
        }
      });

      expect(amazon.jobRunUid).toBe("1234567890");
    });

    it("should return the correct job run UID for pipeline build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_INITIATOR") {
          return "codepipeline/my-pipeline";
        }

        if (key === "CODEBUILD_BUILD_ID") {
          return "guid";
        }
      });

      expect(amazon.jobRunUid).toBe("guid");
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
        }
      });

      expect(amazon.jobRunUrl).toBe(
        "https://console.aws.amazon.com/codebuild/home?region=us-east-1#/builds/my-project:1234567890/view/new",
      );
    });

    it("should return the correct job run URL for pipeline build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-pipeline:abcdef";
        }

        if (key === "CODEBUILD_INITIATOR") {
          return "codepipeline/my-pipeline";
        }
      });

      expect(amazon.jobRunUrl).toBe(
        "https://console.aws.amazon.com/codesuite/codepipeline/pipelines/my-pipeline/executions//timeline?region=us-east-1",
      );
    });

    it("should return the correct job run URL for batch build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-batch:abcdef";
        }

        if (key === "CODEBUILD_BUILD_BATCH_TRIGGERED") {
          return "true";
        }
      });

      expect(amazon.jobRunUrl).toBe(
        "https://console.aws.amazon.com/codesuite/codebuild/123456789012/projects/my-batch/batch/my-batch:abcdef",
      );
    });
  });

  describe("jobRunName", () => {
    it("should return the correct job run name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
        }

        if (key === "CODEBUILD_BUILD_NUMBER") {
          return "1234567890";
        }
      });

      expect(amazon.jobRunName).toBe("my-project-1234567890");
    });

    it("should return the correct job run name for pipeline build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_INITIATOR") {
          return "codepipeline/my-pipeline";
        }

        if (key === "CODEBUILD_BUILD_ID") {
          return "guid";
        }
      });

      expect(amazon.jobRunName).toBe("my-pipeline-guid");
    });
  });

  describe("jobRunBranch", () => {
    it("should extract branch name from source version env variable", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_VERSION") {
          return "refs/heads/main^{commit-hash}";
        }
      });

      expect(amazon.jobRunBranch).toBe("main");
    });

    it("should extract branch name with slashes", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_VERSION") {
          return "refs/heads/feature/branch-name^{abc123}";
        }
      });

      expect(amazon.jobRunBranch).toBe("feature/branch-name");
    });

    it("should return empty string when source version doesn't match pattern", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_VERSION") {
          return "some-other-format";
        }
      });

      expect(amazon.jobRunBranch).toBe("");
    });

    it("should return empty string when source version is empty", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_VERSION") {
          return "";
        }
      });

      expect(amazon.jobRunBranch).toBe("");
    });
  });
});
