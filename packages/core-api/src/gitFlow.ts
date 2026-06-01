/**
 * Git Flow client contracts (Allure 3 → TestOps upload).
 * Wire field names on TestOps API may change; types stay stable in monorepo.
 */

export enum GitProvider {
  Github = "github",
  Gitlab = "gitlab",
  Bitbucket = "bitbucket",
  Other = "other",
}

export interface GitRepositoryRef {
  slug: string;
  url?: string;
}

export interface GitPullRequestRef {
  id: string;
  url?: string;
  title?: string;
}

/** Working-tree signals from `git` CLI (also used in merged upload payload). */
export interface GitLocalState {
  uncommittedChanges: boolean;
  unpublishedCommit: boolean;
  unpublishedBranch: boolean;
  detachedHead: boolean;
}

/** Output of `@allurereport/git` — facts from repository, not CI env. */
export interface GitFacts {
  commit: string;
  branch?: string;
  /** First-parent ancestors of `commit`, newest first; does not include `commit` (HEAD). */
  firstParentAncestors: string[];
  localState?: GitLocalState;
}

/** Output of `@allurereport/ci` `resolveGitHints` — env-derived metadata per CI vendor. */
export interface CiGitHints {
  provider?: GitProvider;
  repository?: GitRepositoryRef;
  sourceBranch?: string;
  targetBranch?: string;
  pullRequest?: GitPullRequestRef;
}
