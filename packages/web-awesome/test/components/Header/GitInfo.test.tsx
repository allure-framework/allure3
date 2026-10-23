import { getReportOptions } from "@allurereport/web-commons";
import { cleanup, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import type { ComponentChildren } from "preact";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("GitInfo");
  await label("coverage", "ui-components");
});

import { GitInfo } from "@/components/Header/GitInfo";

const COMMIT = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";

vi.mock("@allurereport/web-components/core", () => {
  const Menu = (props: { menuTrigger: (p: object) => unknown; children: ComponentChildren }) => (
    <div>
      {props.menuTrigger({ isOpened: false, onClick: () => {} })}
      {props.children}
    </div>
  );

  Menu.Section = (props: { children: ComponentChildren }) => <>{props.children}</>;
  Menu.Item = (props: {
    children: ComponentChildren;
    href?: string;
    onClick?: () => void;
    leadingIcon?: string;
    rightSlot?: unknown;
    copyValue?: string;
    showRightSlotOnHover?: boolean;
    dataTestId?: string;
  }) => {
    const Tag = props.href ? "a" : props.onClick ? "button" : "div";

    return (
      <Tag
        data-testid={props.dataTestId}
        data-slot-on-hover={props.showRightSlotOnHover ? "true" : undefined}
        data-copy-value={props.href ? undefined : props.copyValue}
        href={props.href}
        onClick={props.onClick}
      >
        <i data-id={props.leadingIcon} />
        {props.children}
        {props.rightSlot}
      </Tag>
    );
  };

  return {
    Menu,
    DropdownButton: (props: { text: string; icon?: string }) => (
      <button data-testid="git-info" data-icon={props.icon}>
        {props.text}
      </button>
    ),
    Text: (props: { children: ComponentChildren }) => <span>{props.children}</span>,
    MiddleEllipsis: (props: { text: string }) => <span>{props.text}</span>,
    SvgIcon: (props: { "id": string; "data-testid"?: string }) => (
      <i data-testid={props["data-testid"]} data-id={props.id} />
    ),
    allureIcons: {
      lineDevDataflow3: "branch",
      lineDevCodeSquare: "commit",
      lineGeneralLink1: "link",
      lineGeneralLinkExternal: "external",
    },
  };
});
vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: vi.fn(),
}));
vi.mock("@/stores/locale", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/Header/CiInfo", () => ({
  getCiLabel: (ci?: { pullRequestName?: string; jobRunName?: string }) => ci?.pullRequestName || ci?.jobRunName,
  getCiIconId: (type?: string) => (type && type !== "local" ? `icon-${type}` : undefined),
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("components > Header > GitInfo", () => {
  it("should render the CI icon and the pull request in the trigger, and the CI info, the branch and the whole commit in the menu", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: {
        type: "github",
        pullRequestName: "PR #1",
        pullRequestUrl: "https://example.com/pull/1",
        jobRunBranch: "feature/ci",
      },
      git: { commit: COMMIT, branch: "feature/git" },
    });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info").textContent).toBe("PR #1");
    expect(screen.getByTestId("git-info").getAttribute("data-icon")).toBe("icon-github");
    expect(screen.getByTestId("git-info-ci").textContent).toContain("openPullRequest");
    expect(screen.getByTestId("git-info-branch").textContent).toContain("feature/ci");
    expect(screen.getByTestId("git-info-commit").textContent).toContain(COMMIT);
  });

  it("should render the whole CI row as a link with the CI icon when the url is safe", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: { type: "github", pullRequestName: "PR #1", pullRequestUrl: "https://example.com/pull/1" },
    });

    render(<GitInfo />);

    const row = screen.getByTestId("git-info-ci");

    expect(row.tagName).toBe("A");
    expect(row.getAttribute("href")).toBe("https://example.com/pull/1");
    expect(row.querySelector("[data-id=icon-github]")).not.toBeNull();
  });

  it("should offer to open the job run when there is no pull request", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: { type: "github", jobRunName: "Run #7", jobRunUrl: "https://example.com/run/7" },
    });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info-ci").textContent).toContain("openJobRun");
  });

  it("should keep the leading icon of the CI row when the CI has no icon", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: { type: "local", jobRunName: "Run #7", jobRunUrl: "https://example.com/run/7" },
    });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info-ci").querySelector("[data-id=link]")).not.toBeNull();
  });

  it("should not render the CI row when the url is not safe", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: { type: "github", pullRequestName: "PR #1", pullRequestUrl: "javascript:alert(1)" },
    });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info").textContent).toBe("PR #1");
    expect(screen.queryByTestId("git-info-ci")).not.toBeInTheDocument();
  });

  it("should fall back to the branch of git when there is no CI", () => {
    (getReportOptions as Mock).mockReturnValue({ git: { commit: COMMIT, branch: "main" } });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info").textContent).toBe("main");
    expect(screen.queryByTestId("git-info-ci")).not.toBeInTheDocument();
  });

  it("should use the short commit in the trigger when the branch is unknown", () => {
    (getReportOptions as Mock).mockReturnValue({ git: { commit: COMMIT } });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info").textContent).toBe(COMMIT.slice(0, 7));
    expect(screen.queryByTestId("git-info-branch")).not.toBeInTheDocument();
  });

  it("should render the branch and the commit as links when the repository is known", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: {
        type: "github",
        provider: "github",
        repository: { slug: "a/b", url: "https://example.com/a/b" },
        jobRunBranch: "feature/x",
      },
      git: { commit: COMMIT },
    });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info-branch").getAttribute("href")).toBe("https://example.com/a/b/tree/feature/x");
    expect(screen.getByTestId("git-info-commit").getAttribute("href")).toBe(`https://example.com/a/b/commit/${COMMIT}`);
  });

  it("should mark every link with the icon of an external link", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: {
        type: "github",
        provider: "github",
        pullRequestUrl: "https://example.com/pull/1",
        repository: { slug: "a/b", url: "https://example.com/a/b" },
        jobRunBranch: "main",
      },
      git: { commit: COMMIT },
    });

    render(<GitInfo />);

    for (const id of ["git-info-ci", "git-info-branch", "git-info-commit"]) {
      const row = screen.getByTestId(id);

      expect(row.querySelector("[data-testid=git-info-external-icon]")).not.toBeNull();
      // the icon appears only when the row is hovered
      expect(row.getAttribute("data-slot-on-hover")).toBe("true");
    }
  });

  it("should offer to copy the whole branch and commit when the rows are not links", () => {
    (getReportOptions as Mock).mockReturnValue({ git: { commit: COMMIT, branch: "main" } });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info-branch").getAttribute("data-copy-value")).toBe("main");
    expect(screen.getByTestId("git-info-commit").getAttribute("data-copy-value")).toBe(COMMIT);

    for (const id of ["git-info-branch", "git-info-commit"]) {
      expect(screen.getByTestId(id).querySelector("[data-testid=git-info-external-icon]")).toBeNull();
    }
  });

  it("should not offer to copy the rows which are links", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: { provider: "github", repository: { slug: "a/b", url: "https://example.com/a/b" }, jobRunBranch: "main" },
      git: { commit: COMMIT },
    });

    render(<GitInfo />);

    for (const id of ["git-info-branch", "git-info-commit"]) {
      expect(screen.getByTestId(id).hasAttribute("data-copy-value")).toBe(false);
    }
  });

  it("should treat HEAD of the local CI in the detached head as an unknown branch and keep only the commit", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: { type: "local", sourceBranch: "HEAD", jobRunBranch: "HEAD" },
      git: { commit: COMMIT },
    });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info").textContent).toBe(COMMIT.slice(0, 7));
    expect(screen.queryByTestId("git-info-branch")).not.toBeInTheDocument();
    expect(screen.getByTestId("git-info-commit")).toBeInTheDocument();
  });

  it("should skip HEAD of one CI branch and use the next known branch", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: { sourceBranch: "HEAD", jobRunBranch: "feature/x" },
      git: { commit: COMMIT, branch: "other" },
    });

    render(<GitInfo />);

    expect(screen.getByTestId("git-info-branch").textContent).toContain("feature/x");
  });

  it("should render nothing when there is no git and CI info", () => {
    (getReportOptions as Mock).mockReturnValue({});

    const { container } = render(<GitInfo />);

    expect(container.innerHTML).toBe("");
  });
});
