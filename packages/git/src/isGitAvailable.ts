import { spawnSync } from "node:child_process";

export const isGitAvailable = (): boolean => {
  const result = spawnSync("git", ["--version"], { encoding: "utf-8" });

  return !result.error && result.status === 0;
};
