import { getReportOptions } from "@allurereport/web-commons";
import { cleanup, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { GitInfo } from "@/components/ReportHeader/GitInfo";

const COMMIT = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: vi.fn(),
}));
vi.mock("@/stores/locale", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

beforeEach(async () => {
  cleanup();
  vi.clearAllMocks();
  await epic("coverage");
  await feature("ui-components");
  await story("GitInfo");
  await label("coverage", "ui-components");
});

describe("components > ReportHeader > GitInfo", () => {
  it("shows Git values with descriptive titles and the PR, preferring the source branch", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: {
        type: "github",
        sourceBranch: "feature/source",
        jobRunBranch: "feature/ci",
        pullRequestName: "PR #1",
        pullRequestUrl: "https://example.com/pull/1",
        jobRunUrl: "https://example.com/run/7",
      },
      git: { branch: "feature/git", commit: COMMIT },
    });
    render(<GitInfo />);

    expect(screen.getByTestId("git-info-branch")).toHaveTextContent("feature/source");
    expect(screen.getByTestId("git-info-commit")).toHaveTextContent(COMMIT.slice(0, 7));
    expect(screen.getByTestId("git-info-commit")).toHaveAttribute("title", `gitCommit: ${COMMIT}`);
    expect(screen.getByTestId("git-info-ci")).toHaveTextContent("PR #1");
    expect(screen.getByTestId("git-info-ci")).toHaveAttribute("href", "https://example.com/pull/1");
    expect(screen.getByTestId("git-info-ci")).toHaveAttribute("title", "openPullRequest: PR #1");
    expect(screen.getByTestId("git-info-branch").querySelector("svg, img")).not.toBeNull();
    expect(screen.getByTestId("git-info-commit").querySelector("svg, img")).not.toBeNull();
    expect(screen.getByTestId("git-info-ci").querySelector("svg, img")).not.toBeNull();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { expanded: false })).not.toBeInTheDocument();
  });

  it.each([
    [{ git: { branch: "main" } }, "main"],
    [{ ci: { sourceBranch: "HEAD", jobRunBranch: "feature/x" }, git: { branch: "other" } }, "feature/x"],
    [{ ci: { sourceBranch: "HEAD", jobRunBranch: "HEAD" }, git: { branch: "fallback" } }, "fallback"],
  ])("uses the first known branch for %j", (options, branch) => {
    (getReportOptions as Mock).mockReturnValue(options);
    render(<GitInfo />);
    expect(screen.getByTestId("git-info-branch")).toHaveTextContent(branch);
  });

  it.each([
    { git: { commit: COMMIT } },
    { ci: { sourceBranch: "HEAD", jobRunBranch: "HEAD" }, git: { branch: "HEAD", commit: COMMIT } },
  ])("renders only the short commit when the branch is unknown: %j", (options) => {
    (getReportOptions as Mock).mockReturnValue(options);
    render(<GitInfo />);
    expect(screen.getByTestId("git-info")).toHaveTextContent(COMMIT.slice(0, 7));
    expect(screen.queryByTestId("git-info-branch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("git-info-ci")).not.toBeInTheDocument();
  });

  it("keeps full values as static text when repository links are unavailable", () => {
    const branch = "feature/" + "long-branch".repeat(20);
    (getReportOptions as Mock).mockReturnValue({ git: { branch, commit: COMMIT } });
    render(<GitInfo />);
    expect(screen.getByTestId("git-info-branch")).toHaveTextContent(branch);
    expect(screen.getByTestId("git-info-branch")).toHaveAttribute("title", `gitBranch: ${branch}`);
    expect(screen.getByTestId("git-info-commit")).toHaveAttribute("title", `gitCommit: ${COMMIT}`);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links Git values to the repository without copy controls", () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: {
        provider: "github",
        repository: { slug: "a/b", url: "https://example.com/a/b" },
        jobRunBranch: "feature/x",
      },
      git: { commit: COMMIT },
    });
    render(<GitInfo />);
    expect(screen.getByRole("link", { name: "gitBranch: feature/x" })).toHaveAttribute(
      "href",
      "https://example.com/a/b/tree/feature/x",
    );
    const commit = screen.getByRole("link", { name: `gitCommit: ${COMMIT}` });
    expect(commit).toHaveAttribute("href", `https://example.com/a/b/commit/${COMMIT}`);
    expect(commit).toHaveAttribute("rel", "noopener noreferrer");
    expect(commit).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    [
      { jobRunName: "Run #7", jobRunUrl: "https://example.com/run/7", jobUrl: "https://example.com/job" },
      "Run #7",
      "https://example.com/run/7",
    ],
    [{ jobName: "Job", jobUrl: "https://example.com/job" }, "Job", "https://example.com/job"],
    [{ jobRunUrl: "https://example.com/run/7" }, "https://example.com/run/7", "https://example.com/run/7"],
  ])("renders CI-only metadata for %j", (ci, name, href) => {
    (getReportOptions as Mock).mockReturnValue({ ci });
    render(<GitInfo />);
    expect(screen.getByTestId("git-info-ci")).toHaveTextContent(name);
    expect(screen.getByTestId("git-info-ci")).toHaveAttribute("href", href);
    expect(screen.queryByTestId("git-info-branch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("git-info-commit")).not.toBeInTheDocument();
  });

  it.each([undefined, "javascript:alert(1)"])("keeps the CI label as text when its URL is %s", (jobRunUrl) => {
    (getReportOptions as Mock).mockReturnValue({ ci: { jobRunName: "Run #7", jobRunUrl } });
    render(<GitInfo />);
    expect(screen.getByTestId("git-info-ci")).toHaveTextContent("Run #7");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([{}, { git: { branch: "HEAD" } }])("renders nothing without usable metadata: %j", (options) => {
    (getReportOptions as Mock).mockReturnValue(options);
    const { container } = render(<GitInfo />);
    expect(container).toBeEmptyDOMElement();
  });
});
