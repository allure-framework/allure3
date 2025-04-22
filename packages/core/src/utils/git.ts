import { spawn } from "node:child_process";
import { basename } from "node:path";

/**
 * Returns current git branch name
 * If current directory is not a git repository throws an error
 * @param cwd
 */
export const getGitBranch = (cwd?: string) => {
  return new Promise<string>((resolve, reject) => {
    const git = spawn("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
    let output = "";
    let errorOutput = "";

    git.stdout.on("data", (data) => {
      output += data;
    });
    git.stderr.on("data", (data) => {
      errorOutput += data;
    });
    git.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(errorOutput || "Git command failed"));
      }

      return resolve(output.trim());
    });
    git.on("error", (err) => {
      return reject(err);
    });
  });
};

/**
 * Returns current git repository name
 * If current directory is not a git repository throws an error
 * @param cwd
 */
export const getGitRepoName = (cwd?: string) => {
  return new Promise<string>((resolve, reject) => {
    const git = spawn("git", ["rev-parse", "--show-toplevel"], { cwd });
    let output = "";
    let errorOutput = "";

    git.stdout.on("data", (data) => {
      output += data;
    });
    git.stderr.on("data", (data) => {
      errorOutput += data;
    });
    git.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(errorOutput || "Git command failed"));
      }

      return resolve(basename(output.trim()));
    });
    git.on("error", (err) => {
      return reject(err);
    });
  });
};
