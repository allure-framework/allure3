import type { CiDescriptor } from "@allurereport/core-api";
import { collectGitFacts, isGitAvailable } from "@allurereport/git";

import type { Logger } from "../logger.js";
import { buildGitFlowContext, shouldAttachGitFlow } from "./context.js";
import { projectLaunchGitContext, type ClassifiedGitFlowContext } from "./projection.js";
import type { GitFlowContext, LaunchGitContextDto } from "./types.js";

export type LaunchGitFlowParams = {
  ci: CiDescriptor;
  gitFlow: boolean;
  ancestorLimit: number;
  logger: Logger;
};

export class LaunchGitFlow {
  readonly #ci: CiDescriptor;
  readonly #gitFlow: boolean;
  readonly #ancestorLimit: number;
  readonly #logger: Logger;

  constructor(params: LaunchGitFlowParams) {
    this.#ci = params.ci;
    this.#gitFlow = params.gitFlow;
    this.#ancestorLimit = params.ancestorLimit;
    this.#logger = params.logger;
  }

  resolve(): LaunchGitContextDto | undefined {
    if (!shouldAttachGitFlow(this.#gitFlow)) {
      return undefined;
    }

    if (!isGitAvailable()) {
      this.#logger.warn("git CLI is not available; continuing upload without git context");
      return undefined;
    }

    const facts = collectGitFacts({ ancestorLimit: this.#ancestorLimit });
    const gitFlowContext = buildGitFlowContext({
      ci: this.#ci,
      facts,
      ancestorLimit: this.#ancestorLimit,
    });

    if (!gitFlowContext) {
      this.#logger.warn("Git Flow metadata could not be collected; continuing upload without git context");
      return undefined;
    }

    const classified = this.#classify(gitFlowContext);

    if (!classified) {
      this.#logger.warn(
        "Pull request git context is incomplete (missing source or target branch); continuing upload without git context",
      );
      return undefined;
    }

    const launchGitContext = projectLaunchGitContext(classified, this.#ci);

    if (!launchGitContext) {
      this.#logger.warn("Git provider is not supported by TestOps; continuing upload without git context");
      return undefined;
    }

    return launchGitContext;
  }

  #classify(context: GitFlowContext): ClassifiedGitFlowContext | undefined {
    if (context.pullRequest) {
      const sourceBranch = context.branch;
      const targetBranch = context.targetBranch;

      if (!sourceBranch || !targetBranch) {
        return undefined;
      }

      return {
        kind: "pull_request",
        context,
        sourceBranch,
        targetBranch,
      };
    }

    if (context.branch) {
      return {
        kind: "branch",
        context,
        branch: context.branch,
      };
    }

    return {
      kind: "standalone",
      context,
    };
  }
}
