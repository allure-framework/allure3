import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { collectGitFacts } from "../src/collectGitFacts.js";
import * as runGitModule from "../src/runGit.js";

vi.mock("../src/runGit.js", () => ({
  runGit: vi.fn(),
}));

const runGit = runGitModule.runGit as Mock;

const COMMIT_A = "a".repeat(40);
const COMMIT_B = "b".repeat(40);
const COMMIT_C = "c".repeat(40);

beforeEach(() => {
  vi.clearAllMocks();
});

const mockHappyGit = (params?: { branch?: string; ancestors?: string[]; detached?: boolean }) => {
  const branch = params?.detached ? "HEAD" : (params?.branch ?? "main");
  const ancestors = params?.ancestors ?? [COMMIT_C, COMMIT_B, COMMIT_A];

  runGit.mockImplementation((args: string[]) => {
    const key = args.join(" ");

    if (key === "rev-parse --is-inside-work-tree") {
      return "true";
    }

    if (key === "rev-parse HEAD") {
      return COMMIT_C;
    }

    if (key === "rev-parse --abbrev-ref HEAD") {
      return branch;
    }

    if (key.startsWith("rev-list --first-parent")) {
      return ancestors.join("\n");
    }

    if (key === "status --porcelain") {
      return "";
    }

    if (key === "rev-parse --verify @{u}") {
      return COMMIT_B;
    }

    if (key === "rev-parse --abbrev-ref @{u}") {
      return "origin/main";
    }

    return undefined;
  });
};

describe("collectGitFacts", () => {
  it("returns undefined when not inside a work tree", () => {
    runGit.mockImplementation((args: string[]) => {
      if (args.join(" ") === "rev-parse --is-inside-work-tree") {
        return undefined;
      }
    });

    expect(collectGitFacts()).toBeUndefined();
  });

  it("returns undefined when HEAD cannot be resolved", () => {
    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --is-inside-work-tree") {
        return "true";
      }

      if (key === "rev-parse HEAD") {
        return undefined;
      }
    });

    expect(collectGitFacts()).toBeUndefined();
  });

  it("collects commit, branch, ancestors newest-first, and local state", () => {
    mockHappyGit();

    const facts = collectGitFacts({ ancestorLimit: 2 });

    expect(facts).toEqual({
      commit: COMMIT_C,
      branch: "main",
      firstParentAncestors: [COMMIT_B, COMMIT_A],
      localState: {
        uncommittedChanges: false,
        unpublishedCommit: true,
        unpublishedBranch: false,
        detachedHead: false,
      },
    });

    expect(runGit).toHaveBeenCalledWith(["rev-list", "--first-parent", COMMIT_C, "--max-count=3"], undefined);
  });

  it("returns empty ancestors when HEAD has no parents", () => {
    mockHappyGit({ ancestors: [COMMIT_C] });

    const facts = collectGitFacts();

    expect(facts?.firstParentAncestors).toEqual([]);
    expect(facts?.commit).toBe(COMMIT_C);
  });

  it("respects ancestorLimit in rev-list max-count", () => {
    mockHappyGit({ ancestors: [COMMIT_C, COMMIT_B] });

    collectGitFacts({ ancestorLimit: 1 });

    expect(runGit).toHaveBeenCalledWith(["rev-list", "--first-parent", COMMIT_C, "--max-count=2"], undefined);
  });

  it("omits branch and sets detachedHead when HEAD is detached", () => {
    mockHappyGit({ detached: true });

    const facts = collectGitFacts();

    expect(facts?.branch).toBeUndefined();
    expect(facts?.localState?.detachedHead).toBe(true);
  });

  it("detects uncommitted changes from porcelain status", () => {
    mockHappyGit();

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "status --porcelain") {
        return " M file.ts";
      }

      if (key === "rev-parse --is-inside-work-tree") {
        return "true";
      }

      if (key === "rev-parse HEAD") {
        return COMMIT_C;
      }

      if (key === "rev-parse --abbrev-ref HEAD") {
        return "main";
      }

      if (key.startsWith("rev-list --first-parent")) {
        return [COMMIT_C, COMMIT_A].join("\n");
      }

      if (key === "rev-parse --verify @{u}") {
        return COMMIT_A;
      }

      if (key === "rev-parse --abbrev-ref @{u}") {
        return "origin/main";
      }

      return undefined;
    });

    expect(collectGitFacts()?.localState?.uncommittedChanges).toBe(true);
  });

  it("marks unpublished commit when HEAD is ahead of upstream", () => {
    mockHappyGit();

    expect(collectGitFacts()?.localState?.unpublishedCommit).toBe(true);
  });

  it("marks published commit when HEAD matches upstream", () => {
    mockHappyGit();

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --verify @{u}") {
        return COMMIT_C;
      }

      if (key === "rev-parse --is-inside-work-tree") {
        return "true";
      }

      if (key === "rev-parse HEAD" || key === "rev-parse --verify HEAD") {
        return COMMIT_C;
      }

      if (key === "rev-parse --abbrev-ref HEAD") {
        return "main";
      }

      if (key.startsWith("rev-list --first-parent")) {
        return [COMMIT_C, COMMIT_B].join("\n");
      }

      if (key === "status --porcelain") {
        return "";
      }

      if (key === "rev-parse --abbrev-ref @{u}") {
        return "origin/main";
      }

      return undefined;
    });

    expect(collectGitFacts()?.localState?.unpublishedCommit).toBe(false);
  });

  it("prefers upstream branch name over local branch name", () => {
    mockHappyGit();

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --abbrev-ref HEAD") {
        return "local-feature";
      }

      if (key === "rev-parse --abbrev-ref @{u}") {
        return "origin/feature/foo";
      }

      if (key === "rev-parse --is-inside-work-tree") {
        return "true";
      }

      if (key === "rev-parse HEAD" || key === "rev-parse --verify HEAD") {
        return COMMIT_C;
      }

      if (key.startsWith("rev-list --first-parent")) {
        return [COMMIT_C, COMMIT_B].join("\n");
      }

      if (key === "status --porcelain") {
        return "";
      }

      if (key === "rev-parse --verify @{u}") {
        return COMMIT_B;
      }

      return undefined;
    });

    expect(collectGitFacts()?.branch).toBe("feature/foo");
  });

  it("marks unpublished commit and branch when upstream is missing", () => {
    mockHappyGit();

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --verify @{u}" || key === "rev-parse --abbrev-ref @{u}") {
        return undefined;
      }

      if (key === "rev-parse --is-inside-work-tree") {
        return "true";
      }

      if (key === "rev-parse HEAD") {
        return COMMIT_C;
      }

      if (key === "rev-parse --abbrev-ref HEAD") {
        return "main";
      }

      if (key.startsWith("rev-list --first-parent")) {
        return COMMIT_C;
      }

      if (key === "status --porcelain") {
        return "";
      }

      return undefined;
    });

    const facts = collectGitFacts();

    expect(facts?.localState?.unpublishedCommit).toBe(true);
    expect(facts?.localState?.unpublishedBranch).toBe(true);
  });

  it("passes cwd to git commands", () => {
    mockHappyGit();

    collectGitFacts({ cwd: "/repo" });

    expect(runGit).toHaveBeenCalledWith(["rev-parse", "--is-inside-work-tree"], "/repo");
    expect(runGit).toHaveBeenCalledWith(["rev-parse", "HEAD"], "/repo");
  });
});
