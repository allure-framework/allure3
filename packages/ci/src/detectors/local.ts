import { type CiDescriptor, CiType } from "@allurereport/core-api";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";

export const local: CiDescriptor = {
  type: CiType.Local,

  get detected(): boolean {
    return true;
  },

  get repoName(): string {
    const output = spawnSync("git", ["rev-parse", "--show-toplevel"]);

    if (output.error) {
      return "";
    }

    return basename(output.stdout.toString().trim());
  },

  get jobUid(): string {
    return "";
  },

  get jobUrl(): string {
    return "";
  },

  get jobName(): string {
    return "";
  },

  get jobRunUid(): string {
    return "";
  },

  get jobRunUrl(): string {
    return "";
  },

  get jobRunName(): string {
    return "";
  },

  get jobRunBranch(): string {
    const output = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

    if (output.error) {
      return "";
    }

    return output.stdout.toString().trim();
  },

  get pullRequestUrl(): string {
    return "";
  },

  get pullRequestName(): string {
    return "";
  },
};
