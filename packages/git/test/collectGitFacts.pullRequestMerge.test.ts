import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

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

describe("collectGitFacts on a pull request merge checkout", () => {
  let root: string;
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
  const checkoutMergeRef = (depth?: number) => {
    git(checkout, "init", "-q");
    git(checkout, "remote", "add", "origin", pathToFileURL(join(root, "origin")).href);
    git(
      checkout,
      "fetch",
      "-q",
      ...(depth ? [`--depth=${depth}`] : []),
      "origin",
      "+refs/pull/3/merge:refs/remotes/pull/3/merge",
    );
    git(checkout, "checkout", "-q", "--detach", "refs/remotes/pull/3/merge");
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "allure-git-"));
    checkout = join(root, "checkout");
    const origin = join(root, "origin");

    mkdirSync(origin, { recursive: true });
    mkdirSync(checkout, { recursive: true });
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
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
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

  it("reports the head when no branch of origin points at it, as with a fork", () => {
    git(join(root, "origin"), "branch", "-qD", "feature");
    checkoutMergeRef(1);

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
