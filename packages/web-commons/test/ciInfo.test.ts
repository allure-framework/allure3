import { CiType, GitProvider } from "@allurereport/core-api";
import type { CiDescriptor } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { getCiGitInfo, getCiLabel, getCiLink } from "../src/ciInfo.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("web-commons");
  await story("ci info");
  await label("coverage", "web-commons");
});

const ci = (patch: Partial<CiDescriptor>) => patch as CiDescriptor;

describe("getCiLink", () => {
  it("prefers the pull request, then the job run, then the job", () => {
    expect(getCiLink(ci({ pullRequestUrl: "pr", jobRunUrl: "run", jobUrl: "job" }))).toBe("pr");
    expect(getCiLink(ci({ jobRunUrl: "run", jobUrl: "job" }))).toBe("run");
    expect(getCiLink(ci({ jobUrl: "job" }))).toBe("job");
    expect(getCiLink(undefined)).toBeUndefined();
  });
});

describe("getCiLabel", () => {
  it("prefers the pull request name and falls back to the link", () => {
    expect(getCiLabel(ci({ pullRequestName: "PR #1", jobRunName: "Run #2", jobName: "Job" }), "link")).toBe("PR #1");
    expect(getCiLabel(ci({ jobRunName: "Run #2", jobName: "Job" }), "link")).toBe("Run #2");
    expect(getCiLabel(ci({ jobName: "Job" }), "link")).toBe("Job");
    expect(getCiLabel(ci({}), "link")).toBe("link");
    expect(getCiLabel(undefined, "link")).toBeUndefined();
  });
});

describe("getCiGitInfo", () => {
  it("collects the CI build, the branch and the commit with their links", () => {
    expect(
      getCiGitInfo(
        ci({
          type: CiType.Github,
          provider: GitProvider.Github,
          repository: { slug: "a/b", url: "https://github.com/a/b" } as CiDescriptor["repository"],
          jobRunName: "build #5",
          jobRunUrl: "https://github.com/a/b/actions/runs/5",
          jobRunBranch: "feature/x",
        }),
        { commit: "abcdef1234567", branch: "local" },
      ),
    ).toEqual({
      ciLabel: "build #5",
      ciUrl: "https://github.com/a/b/actions/runs/5",
      isPullRequest: false,
      branch: "feature/x",
      branchUrl: "https://github.com/a/b/tree/feature/x",
      commit: "abcdef1234567",
      commitUrl: "https://github.com/a/b/commit/abcdef1234567",
    });
  });

  it("prefers the pull request and ignores the detached head", () => {
    const data = getCiGitInfo(
      ci({
        type: CiType.Jenkins,
        pullRequestName: "PR 7",
        pullRequestUrl: "https://example.com/pr/7",
        jobRunUrl: "https://example.com/run",
        jobRunBranch: "HEAD",
      }),
      { commit: "abc" },
    );

    expect(data).toMatchObject({
      ciLabel: "PR 7",
      ciUrl: "https://example.com/pr/7",
      isPullRequest: true,
      branch: undefined,
      commit: "abc",
      commitUrl: undefined,
    });
  });

  it("uses the local git information without CI and drops unsafe links", () => {
    expect(getCiGitInfo(undefined, { commit: "abc", branch: "main" })).toMatchObject({
      ciLabel: undefined,
      branch: "main",
      commit: "abc",
    });
    expect(getCiGitInfo(ci({ jobName: "job", jobUrl: "javascript:alert(1)" }))).toMatchObject({
      ciLabel: "job",
      ciUrl: undefined,
    });
    expect(getCiGitInfo()).toMatchObject({ ciLabel: undefined, branch: undefined, commit: undefined });
  });
});
