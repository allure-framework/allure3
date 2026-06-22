import type { GitFacts, GitLocalState } from "@allurereport/core-api";

import { runGit } from "./runGit.js";

export const DEFAULT_ANCESTOR_LIMIT = 100;

export type CollectGitFactsOptions = {
  cwd?: string;
  ancestorLimit?: number;
};

const stripRemotePrefix = (upstreamRef: string): string => {
  const slashIndex = upstreamRef.indexOf("/");

  return slashIndex >= 0 ? upstreamRef.slice(slashIndex + 1) : upstreamRef;
};

const resolveBranch = (cwd?: string): string | undefined => {
  const branchRaw = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);

  if (!branchRaw || branchRaw === "HEAD") {
    return undefined;
  }

  const upstreamBranch = runGit(["rev-parse", "--abbrev-ref", "@{u}"], cwd);

  if (upstreamBranch) {
    return stripRemotePrefix(upstreamBranch);
  }

  return branchRaw;
};

const collectLocalState = (cwd?: string): GitLocalState => {
  const statusPorcelain = runGit(["status", "--porcelain"], cwd) ?? "";
  const branchRaw = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const detachedHead = branchRaw === "HEAD";
  const headCommit = runGit(["rev-parse", "--verify", "HEAD"], cwd);
  const upstreamCommit = runGit(["rev-parse", "--verify", "@{u}"], cwd);
  const upstreamBranch = runGit(["rev-parse", "--abbrev-ref", "@{u}"], cwd);

  return {
    uncommittedChanges: statusPorcelain.length > 0,
    unpublishedCommit: !upstreamCommit || headCommit !== upstreamCommit,
    unpublishedBranch: !upstreamBranch,
    detachedHead,
  };
};

export const collectGitFacts = (options: CollectGitFactsOptions = {}): GitFacts | undefined => {
  const { cwd, ancestorLimit = DEFAULT_ANCESTOR_LIMIT } = options;

  if (runGit(["rev-parse", "--is-inside-work-tree"], cwd) !== "true") {
    return undefined;
  }

  const commit = runGit(["rev-parse", "HEAD"], cwd);

  if (!commit) {
    return undefined;
  }

  const branch = resolveBranch(cwd);

  const revList = runGit(["rev-list", "--first-parent", commit, `--max-count=${ancestorLimit + 1}`], cwd);

  if (!revList) {
    return undefined;
  }

  const firstParentAncestors = revList
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1);

  return {
    commit,
    branch,
    firstParentAncestors,
    localState: collectLocalState(cwd),
  };
};
