import { CiType, GitProvider } from "@allurereport/core-api";
import type { CiDescriptor } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { getGitLinks } from "../src/gitLinks.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("web-commons");
  await story("git links");
  await label("coverage", "web-commons");
});

const ci = (patch: Partial<CiDescriptor>) => patch as CiDescriptor;

describe("getGitLinks", () => {
  it("builds the links from the provider of the CI type", () => {
    expect(
      getGitLinks(ci({ type: CiType.Gitlab, repository: { url: "https://gitlab.com/a/b" } as any }), "main", "abc"),
    ).toEqual({
      branchUrl: "https://gitlab.com/a/b/-/tree/main",
      commitUrl: "https://gitlab.com/a/b/-/commit/abc",
    });
  });

  it("prefers the explicit provider", () => {
    expect(
      getGitLinks(
        ci({
          type: CiType.Jenkins,
          provider: GitProvider.Bitbucket,
          repository: { url: "https://bb.org/a/b/" } as any,
        }),
        undefined,
        "abc",
      ),
    ).toEqual({ branchUrl: undefined, commitUrl: "https://bb.org/a/b/commits/abc" });
  });

  it("returns no links without a repository or a known provider", () => {
    expect(getGitLinks(ci({ type: CiType.Github }), "main", "abc")).toEqual({});
    expect(getGitLinks(ci({ type: CiType.Jenkins, repository: { url: "https://x.org/a" } as any }), "main")).toEqual(
      {},
    );
    expect(getGitLinks(undefined, "main", "abc")).toEqual({});
  });

  it("does not link unsafe repository urls", () => {
    expect(getGitLinks(ci({ type: CiType.Github, repository: { url: "javascript:alert(1)" } as any }), "main")).toEqual(
      {},
    );
  });
});
