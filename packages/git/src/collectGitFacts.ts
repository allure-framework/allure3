import type { GitFacts, GitLocalState } from "@allurereport/core-api";

import { runGit } from "./runGit.js";

export const DEFAULT_ANCESTOR_LIMIT = 100;

export type CollectGitFactsOptions = {
  cwd?: string;
  ancestorLimit?: number;
};

const normalizeAncestorLimit = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  return DEFAULT_ANCESTOR_LIMIT;
};

const normalizePositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  const normalized = Math.floor(value);

  return normalized > 0 ? normalized : undefined;
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

const DEEPEN_FETCH_FILTERS = ["--filter=tree:0", "--filter=blob:none"] as const;

const deepenFetch = (deepenBy: number, cwd?: string): void => {
  const deepen = String(deepenBy);
  const strategies: string[][] = [
    ["fetch", "--deepen", deepen, DEEPEN_FETCH_FILTERS[0]],
    ["fetch", "--deepen", deepen, DEEPEN_FETCH_FILTERS[1]],
    ["fetch", "--deepen", deepen],
  ];

  for (const args of strategies) {
    if (runGit(args, cwd) !== undefined) {
      return;
    }
  }
};

const ensureAncestorHistory = (ancestorLimit: number, cwd?: string): void => {
  if (runGit(["rev-parse", "--is-shallow-repository"], cwd) !== "true") {
    return;
  }

  const needed = ancestorLimit + 1;
  const availableRaw = runGit(["rev-list", "--first-parent", "--count", "HEAD"], cwd);
  const available = normalizePositiveInteger(Number(availableRaw)) ?? 0;

  if (available >= needed) {
    return;
  }

  const deepenBy = normalizePositiveInteger(available > 0 ? needed - available : ancestorLimit);

  if (!deepenBy) {
    return;
  }

  deepenFetch(deepenBy, cwd);
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
  const { cwd } = options;
  const ancestorLimit = normalizeAncestorLimit(options.ancestorLimit);

  if (runGit(["rev-parse", "--is-inside-work-tree"], cwd) !== "true") {
    return undefined;
  }

  const commit = runGit(["rev-parse", "HEAD"], cwd);

  if (!commit) {
    return undefined;
  }

  const branch = resolveBranch(cwd);

  ensureAncestorHistory(ancestorLimit, cwd);

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
