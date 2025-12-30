import { env } from "node:process";

export const getEnv = (key: string): string => env?.[key] ?? "";

export const parseURLPath = (urlString: string): string => {
  try {
    const { pathname } = new URL(urlString);

    return pathname.replace(/^\/+/, "");
  } catch (error) {
    return "";
  }
};

/**
 * Extract repo name from various Git URL formats
 * @example
 * ```js
 * getReponameFromRepoUrl("https://github.com/owner/repo.git") // repo
 * getReponameFromRepoUrl("git@github.com:owner/repo.git")     // repo
 * getReponameFromRepoUrl("https://github.com/owner/repo")     // repo
 * ```
 */
export const getReponameFromRepoUrl = (repoUrl: string): string => repoUrl.match(/\/([^/]+?)(\.git)?$/)?.[1] ?? "";
