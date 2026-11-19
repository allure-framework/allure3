import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, type Mock, vi } from "vite-plus/test";

import { amazon, getPipelineName, isBatchBuild, parseArnValues } from "../../src/detectors/amazon.js";
import { getEnv } from "../../src/utils.js";

beforeEach(async () => {
  await story("amazon");
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
    it("should be true when CODEBUILD_BATCH_BUILD_IDENTIFIER is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BATCH_BUILD_IDENTIFIER") {
          return "batch-id";
        }

        return "";
      });

      expect(isBatchBuild()).toBe(true);
    });

    it("should be true for batch build via CODEBUILD_BUILD_BATCH_TRIGGERED", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_BATCH_TRIGGERED") {
          return "true";
        }

        return "";
      });

      expect(isBatchBuild()).toBe(true);
    });

    it("should be false for non-batch build", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_BATCH_TRIGGERED") {
          return "false";
        }

        return "";
      });

      expect(isBatchBuild()).toBe(false);
    });

    it("should be false for empty string", () => {
      (getEnv as Mock).mockImplementation(() => "");

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

  describe("repoName", () => {
    it("should extract repository name from git url", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_REPO_URL") {
          return "https://github.com/owner/myrepo.git";
        }
      });

      expect(amazon.repoName).toBe("myrepo");
    });

    it("should return empty string when unable to extract repository name", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_REPO_URL") {
          return "invalid-url";
        }
      });

      expect(amazon.repoName).toBe("");
    });

    it("should return empty string when CODEBUILD_SOURCE_REPO_URL is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_REPO_URL") {
          return "";
        }
      });

      expect(amazon.repoName).toBe("");
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

        return "";
      });

      expect(amazon.jobRunUrl).toBe(
        "https://console.aws.amazon.com/codebuild/home?region=us-east-1#/builds/my-project:1234567890/view/new",
      );
    });

    it("should prefer CODEBUILD_BUILD_URL when it is an http(s) URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_URL") {
          return "https://console.aws.amazon.com/codesuite/codebuild/projects/my-project/build/my-project:1234567890";
        }

        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
        }

        return "";
      });

      expect(amazon.jobRunUrl).toBe(
        "https://console.aws.amazon.com/codesuite/codebuild/projects/my-project/build/my-project:1234567890",
      );
    });

    it("should ignore CODEBUILD_BUILD_URL when it is not an http(s) URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_BUILD_URL") {
          return "not-a-url";
        }

        if (key === "CODEBUILD_BUILD_ARN") {
          return "arn:aws:codebuild:us-east-1:123456789012:build/my-project:1234567890";
        }

        return "";
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

        return "";
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

        return "";
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

    it("should return branch name when source version is an unqualified branch", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_VERSION") {
          return "feature/branch-name";
        }
      });

      expect(amazon.jobRunBranch).toBe("feature/branch-name");
    });

    it("should return empty string when source version is a commit hash", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_VERSION") {
          return "1234567890abcdef1234567890abcdef12345678";
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

  describe("pullRequestUrl", () => {
    it("should build GitHub pull request URL from repo and webhook trigger", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        const env: Record<string, string> = {
          CODEBUILD_SOURCE_REPO_URL: "https://github.com/myorg/myrepo.git",
          CODEBUILD_WEBHOOK_TRIGGER: "pr/12",
        };

        return env[key] ?? "";
      });

      expect(amazon.pullRequestUrl).toBe("https://github.com/myorg/myrepo/pull/12");
    });

    it("should build GitLab merge request URL from repo and source version", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        const env: Record<string, string> = {
          CODEBUILD_SOURCE_REPO_URL: "https://gitlab.com/myorg/myrepo.git",
          CODEBUILD_SOURCE_VERSION: "pr/34",
        };

        return env[key] ?? "";
      });

      expect(amazon.pullRequestUrl).toBe("https://gitlab.com/myorg/myrepo/-/merge_requests/34");
    });

    it("should return empty string when pull request id is missing", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CODEBUILD_SOURCE_REPO_URL") {
          return "https://github.com/myorg/myrepo.git";
        }

        return "";
      });

      expect(amazon.pullRequestUrl).toBe("");
    });
  });

  describe("pullRequestName", () => {
    it("should synthesize a pull request name when id is present", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        const env: Record<string, string> = {
          CODEBUILD_WEBHOOK_TRIGGER: "pr/12",
        };

        return env[key] ?? "";
      });

      expect(amazon.pullRequestName).toBe("Pull request #12");
    });

    it("should return empty string when pull request id is missing", () => {
      (getEnv as Mock).mockImplementation(() => "");

      expect(amazon.pullRequestName).toBe("");
    });
  });
});
