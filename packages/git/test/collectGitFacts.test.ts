import { type Mock, beforeEach, describe, it, vi, expect } from "vitest";

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

const mockHappyGit = (params?: {
  branch?: string;
  ancestors?: string[];
  detached?: boolean;
  firstParentCount?: number;
}) => {
  const branch = params?.detached ? "HEAD" : (params?.branch ?? "main");
  const ancestors = params?.ancestors ?? [COMMIT_C, COMMIT_B, COMMIT_A];
  const firstParentCount = params?.firstParentCount ?? ancestors.length;

  runGit.mockImplementation((args: string[]) => {
    const key = args.join(" ");

    if (key === "rev-parse --is-inside-work-tree" || key === "rev-parse --is-shallow-repository") {
      return key === "rev-parse --is-shallow-repository" ? "false" : "true";
    }

    if (key === "rev-parse HEAD") {
      return COMMIT_C;
    }

    if (key === "rev-parse --abbrev-ref HEAD") {
      return branch;
    }

    if (key === "rev-list --first-parent --count HEAD") {
      return String(firstParentCount);
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

    expect(collectGitFacts(), "returns undefined outside a git work tree").toBeUndefined();
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

    expect(collectGitFacts(), "returns undefined when HEAD cannot be resolved").toBeUndefined();
  });

  it("collects commit, branch, ancestors newest-first, and local state", () => {
    mockHappyGit();

    const facts = collectGitFacts({ ancestorLimit: 2 });

    expect(facts, "collects commit, branch, first-parent ancestors newest-first, and local state").toEqual({
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

    expect(runGit.mock.calls, "limits rev-list to ancestorLimit plus HEAD").toEqual(
      expect.arrayContaining([[["rev-list", "--first-parent", COMMIT_C, "--max-count=3"], undefined]]),
    );
  });

  it("returns empty ancestors when HEAD has no parents", () => {
    mockHappyGit({ ancestors: [COMMIT_C] });

    const facts = collectGitFacts();

    expect(facts, "keeps HEAD commit and returns no ancestors for a root commit").toEqual({
      commit: COMMIT_C,
      branch: "main",
      firstParentAncestors: [],
      localState: {
        uncommittedChanges: false,
        unpublishedCommit: true,
        unpublishedBranch: false,
        detachedHead: false,
      },
    });
  });

  it("respects ancestorLimit in rev-list max-count", () => {
    mockHappyGit({ ancestors: [COMMIT_C, COMMIT_B] });

    collectGitFacts({ ancestorLimit: 1 });

    expect(runGit.mock.calls, "passes ancestorLimit to rev-list max-count as limit plus one for HEAD").toEqual(
      expect.arrayContaining([[["rev-list", "--first-parent", COMMIT_C, "--max-count=2"], undefined]]),
    );
  });

  it("omits branch and sets detachedHead when HEAD is detached", () => {
    mockHappyGit({ detached: true });

    const facts = collectGitFacts();

    expect(facts, "omits branch name and marks detached HEAD in local state").toMatchObject({
      branch: undefined,
      localState: {
        detachedHead: true,
      },
    });
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

    expect(
      collectGitFacts()?.localState?.uncommittedChanges,
      "detects uncommitted changes from porcelain status output",
    ).toBe(true);
  });

  it("marks unpublished commit when HEAD is ahead of upstream", () => {
    mockHappyGit();

    expect(
      collectGitFacts()?.localState?.unpublishedCommit,
      "marks unpublished commit when HEAD differs from upstream",
    ).toBe(true);
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

    expect(collectGitFacts()?.localState?.unpublishedCommit, "marks published commit when HEAD matches upstream").toBe(
      false,
    );
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

    expect(collectGitFacts()?.branch, "prefers upstream branch name over local branch name").toBe("feature/foo");
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

    expect(
      collectGitFacts()?.localState,
      "marks unpublished commit and branch when upstream tracking is missing",
    ).toMatchObject({
      unpublishedCommit: true,
      unpublishedBranch: true,
    });
  });

  it("passes cwd to git commands", () => {
    mockHappyGit();

    collectGitFacts({ cwd: "/repo" });

    expect(runGit.mock.calls, "forwards working directory to git commands").toEqual(
      expect.arrayContaining([
        [["rev-parse", "--is-inside-work-tree"], "/repo"],
        [["rev-parse", "HEAD"], "/repo"],
      ]),
    );
  });

  it("deepens shallow history before collecting ancestors", () => {
    mockHappyGit();

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --is-shallow-repository") {
        return "true";
      }

      if (key === "rev-list --first-parent --count HEAD") {
        return "2";
      }

      if (key === "fetch --deepen 41 origin") {
        return "";
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
        return [COMMIT_C, COMMIT_B].join("\n");
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

    collectGitFacts({ ancestorLimit: 42 });

    expect(runGit.mock.calls, "counts first-parent history, deepens shallow clone, and lists ancestors").toEqual(
      expect.arrayContaining([
        [["rev-list", "--first-parent", "--count", "HEAD"], undefined],
        [["fetch", "--deepen", "41", "origin"], undefined],
        [["rev-list", "--first-parent", COMMIT_C, "--max-count=43"], undefined],
      ]),
    );
  });

  it("skips fetch when shallow repository already has enough first-parent history", () => {
    mockHappyGit({ firstParentCount: 150 });

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --is-shallow-repository") {
        return "true";
      }

      if (key === "rev-list --first-parent --count HEAD") {
        return "150";
      }

      if (key.startsWith("fetch --deepen")) {
        return "";
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
        return [COMMIT_C, COMMIT_B, COMMIT_A].join("\n");
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

    collectGitFacts({ ancestorLimit: 100 });

    expect(
      runGit.mock.calls.filter((call) => call[0][0] === "fetch"),
      "skips fetch when shallow repository already has enough first-parent history",
    ).toEqual([]);
  });

  it("deepens only the missing first-parent commits for partial shallow history", () => {
    mockHappyGit();

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --is-shallow-repository") {
        return "true";
      }

      if (key === "rev-list --first-parent --count HEAD") {
        return "50";
      }

      if (key === "fetch --deepen 51 origin") {
        return "";
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
        return [COMMIT_C, COMMIT_B].join("\n");
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

    collectGitFacts({ ancestorLimit: 100 });

    expect(runGit.mock.calls, "deepens shallow history only by the missing first-parent commits").toEqual(
      expect.arrayContaining([[["fetch", "--deepen", "51", "origin"], undefined]]),
    );
  });

  it("skips fetch when repository is not shallow", () => {
    mockHappyGit();

    collectGitFacts({ ancestorLimit: 10 });

    expect(
      runGit.mock.calls.filter((call) => call[0][0] === "fetch"),
      "skips fetch when repository is not shallow",
    ).toEqual([]);
  });

  it("continues lineage collection when deepen fetch fails", () => {
    mockHappyGit();

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --is-shallow-repository") {
        return "true";
      }

      if (key === "rev-list --first-parent --count HEAD") {
        return "2";
      }

      if (key === "fetch --deepen 99 origin") {
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
        return [COMMIT_C, COMMIT_B].join("\n");
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

    expect(collectGitFacts()?.firstParentAncestors, "continues lineage collection when deepen fetch fails").toEqual([
      COMMIT_B,
    ]);
  });

  it("falls back to ancestorLimit deepen when first-parent count is unavailable", () => {
    mockHappyGit();

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --is-shallow-repository") {
        return "true";
      }

      if (key === "rev-list --first-parent --count HEAD") {
        return undefined;
      }

      if (key === "fetch --deepen 100 origin") {
        return "";
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
        return [COMMIT_C, COMMIT_B].join("\n");
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

    collectGitFacts({ ancestorLimit: 100 });

    expect(runGit.mock.calls, "falls back to ancestorLimit deepen when first-parent count is unavailable").toEqual(
      expect.arrayContaining([[["fetch", "--deepen", "100", "origin"], undefined]]),
    );
  });

  it("rejects unsafe ancestorLimit values before passing them to git", () => {
    mockHappyGit();

    runGit.mockImplementation((args: string[]) => {
      const key = args.join(" ");

      if (key === "rev-parse --is-shallow-repository") {
        return "true";
      }

      if (key === "rev-list --first-parent --count HEAD") {
        return "1";
      }

      if (key.startsWith("fetch --deepen")) {
        return "";
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
        return [COMMIT_C, COMMIT_B].join("\n");
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

    collectGitFacts({ ancestorLimit: "--upload-pack=evil" as unknown as number });

    expect(
      runGit.mock.calls.filter((call) => call[0][0] === "fetch"),
      "uses default ancestor limit instead of unsafe git option strings",
    ).toEqual([[["fetch", "--deepen", "100", "origin"], undefined]]);
  });
});
