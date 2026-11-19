import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { collectGitFacts } from "../src/collectGitFacts.js";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
    },
  }).trim();

describe("collectGitFacts on a pull request merge checkout", { timeout: 15_000 }, () => {
  let root: string;
  let origin: string;
  let checkout: string;
  let base: { first: string; second: string };
  let pr: { first: string; head: string };
  let merge: string;

  const commitFile = (cwd: string, name: string) => {
    writeFileSync(join(cwd, name), name);
    git(cwd, "add", name);
    git(cwd, "commit", "-qm", name);

    return git(cwd, "rev-parse", "HEAD");
  };

  /** Checks the merge out the way `actions/checkout` does on a `pull_request` run. */
  const checkoutMergeRef = (depth?: number, pullRequest = 3, remote = origin) => {
    git(checkout, "init", "-q");
    git(checkout, "remote", "add", "origin", pathToFileURL(remote).href);
    git(
      checkout,
      "fetch",
      "-q",
      ...(depth ? [`--depth=${depth}`] : []),
      "origin",
      `+refs/pull/${pullRequest}/merge:refs/remotes/pull/${pullRequest}/merge`,
    );
    git(checkout, "checkout", "-q", "--detach", `refs/remotes/pull/${pullRequest}/merge`);
  };

  // Build the commit graph once. Each test fetches into its own empty checkout.
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "allure-git-"));
    origin = mkdtempSync(join(root, "origin-"));
    git(origin, "init", "-q", "-b", "main");
    const firstBase = commitFile(origin, "base1");

    git(origin, "checkout", "-q", "-b", "feature");
    const firstPr = commitFile(origin, "pr1");
    const prHead = commitFile(origin, "pr2");

    git(origin, "checkout", "-q", "main");
    const secondBase = commitFile(origin, "base2");

    git(origin, "merge", "-q", "--no-ff", "-m", "Merge", "feature");
    merge = git(origin, "rev-parse", "HEAD");
    git(origin, "update-ref", "refs/pull/3/merge", merge);
    git(origin, "reset", "-q", "--hard", secondBase);
    base = { first: firstBase, second: secondBase };
    pr = { first: firstPr, head: prHead };
  }, 30_000);

  beforeEach(() => {
    checkout = mkdtempSync(join(root, "checkout-"));
  });

  afterAll(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  it("reports the pull request head and its history for a full checkout", () => {
    checkoutMergeRef();

    expect(collectGitFacts({ cwd: checkout, sourceCommit: pr.head })).toMatchObject({
      commit: pr.head,
      firstParentAncestors: [pr.first, base.first],
    });
  });

  it("reports the pull request head for the default depth 1 checkout", () => {
    checkoutMergeRef(1);

    expect(collectGitFacts({ cwd: checkout, sourceCommit: pr.head })).toMatchObject({
      commit: pr.head,
      firstParentAncestors: [pr.first, base.first],
    });
  });

  it(
    "fetches the head history when the merge history is deep enough but the head's is not",
    { timeout: 30_000 },
    () => {
      const longOrigin = mkdtempSync(join(root, "long-"));
      cpSync(origin, longOrigin, { recursive: true });
      git(longOrigin, "checkout", "-q", "-b", "long", base.first);
      const [first, second, head] = ["long1", "long2", "long3"].map((name) => commitFile(longOrigin, name));
      git(longOrigin, "checkout", "-q", "main");
      git(longOrigin, "merge", "-q", "--no-ff", "-m", "Merge long", "long");
      git(longOrigin, "update-ref", "refs/pull/4/merge", git(longOrigin, "rev-parse", "HEAD"));
      git(longOrigin, "reset", "-q", "--hard", base.second);
      git(longOrigin, "branch", "-qD", "long");

      // Depth 3 shows three first-parent commits of the merge, but only two of the head.
      checkoutMergeRef(3, 4, longOrigin);

      expect(collectGitFacts({ cwd: checkout, sourceCommit: head, ancestorLimit: 2 })).toMatchObject({
        commit: head,
        firstParentAncestors: [second, first],
      });
    },
  );

  it("reports the head when no branch of origin points at it, as with a fork", () => {
    const forkOrigin = mkdtempSync(join(root, "fork-"));
    cpSync(origin, forkOrigin, { recursive: true });
    git(forkOrigin, "branch", "-qD", "feature");
    checkoutMergeRef(1, 3, forkOrigin);

    expect(collectGitFacts({ cwd: checkout, sourceCommit: pr.head })?.commit).toBe(pr.head);
  });

  it("keeps HEAD when the CI commit is not the merged pull request head", () => {
    checkoutMergeRef();

    expect(collectGitFacts({ cwd: checkout, sourceCommit: pr.first })).toMatchObject({
      commit: merge,
      firstParentAncestors: [base.second, base.first],
    });
  });

  it("keeps HEAD when the CI commit is the merge target, not the merged branch", () => {
    checkoutMergeRef();

    expect(collectGitFacts({ cwd: checkout, sourceCommit: base.second })?.commit).toBe(merge);
  });

  it("keeps HEAD when no CI commit is known", () => {
    checkoutMergeRef();

    expect(collectGitFacts({ cwd: checkout })?.commit).toBe(merge);
  });

  it("keeps HEAD when it is an ordinary commit", () => {
    checkoutMergeRef();
    git(checkout, "checkout", "-q", "--detach", pr.head);

    expect(collectGitFacts({ cwd: checkout, sourceCommit: pr.head })).toMatchObject({
      commit: pr.head,
      firstParentAncestors: [pr.first, base.first],
    });
  });
});
