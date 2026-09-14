import { spawnSync } from "node:child_process";

const isGitDebugEnabled = (): boolean => {
  const value = process.env.ALLURE_DEBUG?.trim().toLowerCase();

  return value === "1" || value === "true";
};

const hasUnsafeGitArgs = (args: string[]): boolean => {
  return args.some((arg) => arg === "--upload-pack" || arg.startsWith("--upload-pack="));
};

export const runGit = (args: string[], cwd?: string): string | undefined => {
  if (hasUnsafeGitArgs(args)) {
    if (isGitDebugEnabled()) {
      process.stderr.write(`[allurereport/git] blocked unsafe git arguments: ${args.join(" ")}\n`);
    }

    return undefined;
  }

  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
  });

  if (result.error || result.status !== 0) {
    if (isGitDebugEnabled()) {
      const stderr = result.stderr?.trim();
      const status = result.status ?? "n/a";

      process.stderr.write(
        `[allurereport/git] git ${args.join(" ")} failed (status=${status})${stderr ? `: ${stderr}` : ""}\n`,
      );
    }

    return undefined;
  }

  return result.stdout.trim();
};
