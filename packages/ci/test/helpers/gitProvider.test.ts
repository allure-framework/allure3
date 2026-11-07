import { GitProvider } from "@allurereport/core-api";
import { describe, expect, it } from "vite-plus/test";

import {
  buildPullRequestUrlForProvider,
  inferGitProviderFromUrl,
  normalizeGitRemoteUrl,
  parsePullRequestNumberFromUrl,
  parseRepositorySlugFromUrl,
  resolveRepositoryFromGitUrl,
  stripRefsHeads,
} from "../../src/helpers/gitProvider.js";

describe("gitProvider helpers", () => {
  it("normalizes scp-style remotes", () => {
    expect(normalizeGitRemoteUrl("git@github.com:myorg/myrepo.git")).toBe("https://github.com/myorg/myrepo.git");
  });

  it("infers github provider and slug from https remote", () => {
    expect(resolveRepositoryFromGitUrl("https://github.com/myorg/myrepo.git")).toEqual({
      provider: GitProvider.Github,
      slug: "myorg/myrepo",
      url: "https://github.com/myorg/myrepo",
    });
  });

  it("infers gitlab provider with nested group slug", () => {
    expect(inferGitProviderFromUrl("https://gitlab.com/my/group/myrepo")).toBe(GitProvider.Gitlab);
    expect(parseRepositorySlugFromUrl("https://gitlab.com/my/group/myrepo", GitProvider.Gitlab)).toBe(
      "my/group/myrepo",
    );
  });

  it("returns undefined for unsupported hosts", () => {
    expect(inferGitProviderFromUrl("https://dev.azure.com/org/project/_git/repo")).toBeUndefined();
  });

  it("strips refs/heads prefix", () => {
    expect(stripRefsHeads("refs/heads/feature/foo")).toBe("feature/foo");
  });

  it("parses pull request number from PR URLs", () => {
    expect(parsePullRequestNumberFromUrl("https://github.com/org/repo/pull/55")).toBe("55");
    expect(parsePullRequestNumberFromUrl("https://gitlab.com/org/repo/-/merge_requests/7")).toBe("7");
  });

  it("builds pull request URLs for known providers", () => {
    expect(buildPullRequestUrlForProvider(GitProvider.Github, "https://github.com/org/repo.git", "55")).toBe(
      "https://github.com/org/repo/pull/55",
    );
    expect(buildPullRequestUrlForProvider(GitProvider.Gitlab, "https://gitlab.com/org/repo/", "7")).toBe(
      "https://gitlab.com/org/repo/-/merge_requests/7",
    );
    expect(buildPullRequestUrlForProvider(GitProvider.Bitbucket, "https://bitbucket.org/org/repo.git", "9")).toBe(
      "https://bitbucket.org/org/repo/pull-requests/9",
    );
  });
});
