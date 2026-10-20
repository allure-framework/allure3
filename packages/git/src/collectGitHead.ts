import { runGit } from "./runGit.js";

export type GitHead = {
  commit: string;
  branch?: string;
};

/**
 * Reads the commit and the branch of HEAD without touching the history, so it never fetches anything,
 * unlike `collectGitFacts`. The branch is omitted for a detached HEAD.
 */
export const collectGitHead = (options: { cwd?: string } = {}): GitHead | undefined => {
  const { cwd } = options;

  if (runGit(["rev-parse", "--is-inside-work-tree"], cwd) !== "true") {
    return undefined;
  }

  const commit = runGit(["rev-parse", "HEAD"], cwd);

  if (!commit) {
    return undefined;
  }

  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);

  return { commit, branch: branch && branch !== "HEAD" ? branch : undefined };
};
