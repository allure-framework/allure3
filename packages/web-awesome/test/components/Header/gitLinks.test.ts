import { CiType, GitProvider } from "@allurereport/core-api";
import type { CiDescriptor } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { getGitLinks } from "@/components/ReportHeader/GitInfo/links";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("GitInfo");
  await label("coverage", "ui-components");
});

const ci = (patch: Partial<CiDescriptor>) => patch as CiDescriptor;
const SHA = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";

describe("components > Header > GitInfo > getGitLinks", () => {
  it("builds the links of GitHub", () => {
    expect(
      getGitLinks(
        ci({ provider: GitProvider.Github, repository: { slug: "a/b", url: "https://github.com/a/b/" } }),
        "feature/x y",
        SHA,
      ),
    ).toEqual({
      branchUrl: "https://github.com/a/b/tree/feature/x%20y",
      commitUrl: `https://github.com/a/b/commit/${SHA}`,
    });
  });

  it("builds the links of GitLab", () => {
    expect(
      getGitLinks(
        ci({ provider: GitProvider.Gitlab, repository: { slug: "a/b", url: "https://gitlab.com/a/b" } }),
        "main",
        SHA,
      ),
    ).toEqual({
      branchUrl: "https://gitlab.com/a/b/-/tree/main",
      commitUrl: `https://gitlab.com/a/b/-/commit/${SHA}`,
    });
  });

  it("builds the links of Bitbucket", () => {
    expect(
      getGitLinks(
        ci({ provider: GitProvider.Bitbucket, repository: { slug: "a/b", url: "https://bitbucket.org/a/b" } }),
        "main",
        SHA,
      ),
    ).toEqual({
      branchUrl: "https://bitbucket.org/a/b/branch/main",
      commitUrl: `https://bitbucket.org/a/b/commits/${SHA}`,
    });
  });

  it("takes the provider from the type of the CI when the provider is not detected", () => {
    expect(
      getGitLinks(ci({ type: CiType.Github, repository: { slug: "a/b", url: "https://github.com/a/b" } }), "main", SHA)
        .branchUrl,
    ).toBe("https://github.com/a/b/tree/main");
  });

  it("builds only the links of the known parts", () => {
    expect(
      getGitLinks(
        ci({ provider: GitProvider.Github, repository: { slug: "a/b", url: "https://github.com/a/b" } }),
        undefined,
        SHA,
      ),
    ).toEqual({ branchUrl: undefined, commitUrl: `https://github.com/a/b/commit/${SHA}` });
  });

  it("builds nothing without the repository, with an unknown provider or with an unsafe url", () => {
    expect(getGitLinks(undefined, "main", SHA)).toEqual({});
    expect(getGitLinks(ci({ provider: GitProvider.Github }), "main", SHA)).toEqual({});
    expect(
      getGitLinks(
        ci({ provider: GitProvider.Other, repository: { slug: "a/b", url: "https://example.com/a/b" } }),
        "main",
        SHA,
      ),
    ).toEqual({});
    expect(
      getGitLinks(
        ci({ provider: GitProvider.Github, repository: { slug: "a/b", url: "javascript:alert(1)" } }),
        "main",
        SHA,
      ),
    ).toEqual({});
  });
});
