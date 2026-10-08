import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { gitlab } from "../../src/detectors/gitlab.js";
import { getEnv } from "../../src/utils.js";

const mockEnv = (env: Record<string, string>) => {
  (getEnv as Mock).mockImplementation((key: string) => env[key] ?? "");
};

beforeEach(async () => {
  await story("gitlab");
});
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

  describe("repoName", () => {
    it("should return repository name when CI_PROJECT_NAME is set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_NAME") {
          return "myrepo";
        }
      });

      expect(gitlab.repoName).toBe("myrepo");
    });

    it("should return empty string when CI_PROJECT_NAME is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_NAME") {
          return "";
        }
      });

      expect(gitlab.repoName).toBe("");
    });
  });

  describe("jobUID", () => {
    it("should return the correct job UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_ID") {
          return "12345";
        }
      });

      expect(gitlab.jobUid).toBe("12345");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_ID") {
          return "";
        }
      });

      expect(gitlab.jobUid).toBe("");
    });
  });

  describe("jobURL", () => {
    it("should return the correct job URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_URL") {
          return "https://gitlab.com/myorg/myrepo";
        }
      });

      expect(gitlab.jobUrl).toBe("https://gitlab.com/myorg/myrepo/pipelines");
    });

    it("should return '/pipelines' when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PROJECT_URL") {
          return "";
        }
      });

      expect(gitlab.jobUrl).toBe("/pipelines");
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
  });

  describe("ciJobName", () => {
    it("should return the current GitLab job name", () => {
      mockEnv({ CI_JOB_NAME: "tests", CI_PROJECT_NAME: "project" });

      expect(gitlab.ciJobName).toBe("tests");
    });

    it("should not fall back to the project name when the CI job name is missing", () => {
      mockEnv({ CI_JOB_NAME: "", CI_PROJECT_NAME: "project" });

      expect(gitlab.ciJobName).toBe("");
    });
  });

  describe("jobRunUID", () => {
    it("should return the correct job run UID", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return "67890";
        }
      });

      expect(gitlab.jobRunUid).toBe("67890");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_ID") {
          return "";
        }
      });

      expect(gitlab.jobRunUid).toBe("");
    });
  });

  describe("jobRunURL", () => {
    it("should return the correct job run URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_URL") {
          return "https://gitlab.com/myorg/myrepo/-/pipelines/67890";
        }
      });

      expect(gitlab.jobRunUrl).toBe("https://gitlab.com/myorg/myrepo/-/pipelines/67890");
    });

    it("should return empty string when environment variable is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_PIPELINE_URL") {
          return "";
        }
      });

      expect(gitlab.jobRunUrl).toBe("");
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

    it("should use merge request source branch before the commit ref", () => {
      mockEnv({
        CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: "feature/foo",
        CI_COMMIT_REF_NAME: "refs/merge-requests/7/head",
      });

      expect(gitlab.jobRunBranch).toBe("feature/foo");
    });

    it("should return tag refs as the job run ref", () => {
      mockEnv({
        CI_COMMIT_REF_NAME: "v1.0.0",
        CI_COMMIT_TAG: "v1.0.0",
      });

      expect(gitlab.jobRunBranch).toBe("v1.0.0");
    });
  });

  describe("sourceBranch", () => {
    it("should return merge request source branch", () => {
      mockEnv({
        CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: "feature/foo",
        CI_COMMIT_REF_NAME: "refs/merge-requests/7/head",
      });

      expect(gitlab.sourceBranch).toBe("feature/foo");
    });

    it("should return the commit ref for branch pipelines", () => {
      mockEnv({
        CI_COMMIT_BRANCH: "ignored-by-gitlab-integration",
        CI_COMMIT_REF_NAME: "feature/bar",
      });

      expect(gitlab.sourceBranch).toBe("feature/bar");
    });

    it("should return tag refs as the source ref", () => {
      mockEnv({
        CI_COMMIT_REF_NAME: "v1.0.0",
        CI_COMMIT_TAG: "v1.0.0",
      });

      expect(gitlab.sourceBranch).toBe("v1.0.0");
    });
  });

  describe("jobArtifactsUrlBase", () => {
    it.each([
      {
        name: "GitLab.com defaults",
        env: {},
        expected: "https://myorg.gitlab.io/-/myrepo/-/jobs/678/artifacts",
      },
      {
        name: "a custom Pages domain",
        env: { CI_SERVER_URL: "https://gitlab.example.com/gitlab/", CI_PAGES_DOMAIN: "pages.example.com" },
        expected: "https://myorg.pages.example.com/-/myrepo/-/jobs/678/artifacts",
      },
      {
        name: "an HTTP self-managed instance",
        env: { CI_SERVER_URL: "http://gitlab.example.com", CI_PAGES_DOMAIN: "pages.example.com" },
        expected: "http://myorg.pages.example.com/-/myrepo/-/jobs/678/artifacts",
      },
    ])("should build the artifact preview base for $name", ({ env, expected }) => {
      mockEnv({
        CI_PROJECT_ROOT_NAMESPACE_SLUG: "myorg",
        CI_PROJECT_NAME: "myrepo",
        CI_JOB_ID: "678",
        ...env,
      });

      expect(gitlab.jobArtifactsUrlBase).toBe(expected);
    });
  });

  describe("GitLab integration metadata", () => {
    it("should expose non-secret project, job, merge request, and endpoint fields", () => {
      mockEnv({
        CI_PROJECT_ID: "12345",
        CI_PROJECT_PATH: "myorg/myrepo",
        CI_PROJECT_DIR: "/builds/myorg/myrepo",
        CI_PIPELINE_SOURCE: "merge_request_event",
        CI_JOB_ID: "678",
        CI_JOB_URL: "https://gitlab.example.com/myorg/myrepo/-/jobs/678",
        CI_MERGE_REQUEST_PROJECT_ID: "999",
        CI_API_V4_URL: "https://gitlab.example.com/gitlab/api/v4",
        CI_API_GRAPHQL_URL: "https://gitlab.example.com/gitlab/api/graphql",
        CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: "feature/foo",
        CI_COMMIT_REF_NAME: "refs/merge-requests/7/head",
        GITLAB_TOKEN: "secret-token",
      });

      expect(gitlab.projectId).toBe("12345");
      expect(gitlab.projectPath).toBe("myorg/myrepo");
      expect(gitlab.projectDirectory).toBe("/builds/myorg/myrepo");
      expect(gitlab.pipelineSource).toBe("merge_request_event");
      expect(gitlab.currentJobId).toBe("678");
      expect(gitlab.currentJobUrl).toBe("https://gitlab.example.com/myorg/myrepo/-/jobs/678");
      expect(gitlab.mergeRequestProjectId).toBe("999");
      expect(gitlab.restApiUrl).toBe("https://gitlab.example.com/gitlab/api/v4");
      expect(gitlab.graphqlApiUrl).toBe("https://gitlab.example.com/gitlab/api/graphql");
      expect(gitlab.ref).toBe("feature/foo");
      expect(JSON.stringify(gitlab)).not.toContain("secret-token");
    });

    it("should derive prefixed API endpoints from CI_SERVER_URL", () => {
      mockEnv({ CI_SERVER_URL: "https://gitlab.example.com/gitlab/" });

      expect(gitlab.restApiUrl).toBe("https://gitlab.example.com/gitlab/api/v4");
      expect(gitlab.graphqlApiUrl).toBe("https://gitlab.example.com/gitlab/api/graphql");
    });
  });

  describe("pullRequestUrl", () => {
    it("should return the correct pull request URL", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_MERGE_REQUEST_IID") {
          return "123";
        }

        if (key === "CI_PROJECT_URL") {
          return "https://gitlab.com/myorg/myrepo";
        }
      });

      expect(gitlab.pullRequestUrl).toBe("https://gitlab.com/myorg/myrepo/-/merge_requests/123");
    });

    it("should return empty string when CI_MERGE_REQUEST_IID is not set", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_MERGE_REQUEST_IID") {
          return "";
        }
      });

      expect(gitlab.pullRequestUrl).toBe("");
    });

    it("should handle custom GitLab instance hosts", () => {
      (getEnv as Mock).mockImplementation((key: string) => {
        if (key === "CI_MERGE_REQUEST_IID") {
          return "123";
        }

        if (key === "CI_PROJECT_URL") {
          return "https://gitlab.example.com/myorg/myrepo";
        }
      });

      expect(gitlab.pullRequestUrl).toBe("https://gitlab.example.com/myorg/myrepo/-/merge_requests/123");
    });

    it("should prefer merge request project URL", () => {
      mockEnv({
        CI_MERGE_REQUEST_IID: "123",
        CI_MERGE_REQUEST_PROJECT_URL: "https://gitlab.com/parent/repo",
        CI_PROJECT_URL: "https://gitlab.com/fork/repo",
      });

      expect(gitlab.pullRequestUrl).toBe("https://gitlab.com/parent/repo/-/merge_requests/123");
    });

    it("should return empty string when project URL is missing", () => {
      mockEnv({
        CI_MERGE_REQUEST_IID: "123",
      });

      expect(gitlab.pullRequestUrl).toBe("");
    });
  });
});
