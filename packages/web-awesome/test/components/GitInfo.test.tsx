import { copyToClipboard, getReportOptions } from "@allurereport/web-commons";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { GitInfo } from "@/components/ReportHeader/GitInfo";

const COMMIT = "0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: vi.fn(),
  copyToClipboard: vi.fn(),
}));
vi.mock("@/stores/locale", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

beforeEach(async () => {
  cleanup();
  vi.clearAllMocks();
  (copyToClipboard as Mock).mockResolvedValue(true);
  await epic("coverage");
  await feature("ui-components");
  await story("GitInfo");
  await label("coverage", "ui-components");
});

describe("components > ReportHeader > GitInfo", () => {
  it("shows labelled Git values and the PR immediately, preferring the source branch", () => {
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

    expect(screen.getByTestId("git-info-branch")).toHaveTextContent("gitBranch: feature/source");
    expect(screen.getByTestId("git-info-commit")).toHaveTextContent(`gitCommit: ${COMMIT.slice(0, 7)}`);
    expect(screen.getByTestId("git-info-commit")).toHaveAttribute("title", COMMIT);
    expect(screen.getByTestId("git-info-ci")).toHaveTextContent("PR #1");
    expect(screen.getByTestId("git-info-ci")).toHaveAttribute("href", "https://example.com/pull/1");
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
    expect(screen.getByTestId("git-info-branch")).toHaveTextContent(`gitBranch: ${branch}`);
  });

  it.each([
    { git: { commit: COMMIT } },
    { ci: { sourceBranch: "HEAD", jobRunBranch: "HEAD" }, git: { branch: "HEAD", commit: COMMIT } },
  ])("renders only the short commit when the branch is unknown: %j", (options) => {
    (getReportOptions as Mock).mockReturnValue(options);
    render(<GitInfo />);
    expect(screen.getByTestId("git-info")).toHaveTextContent(`gitCommit: ${COMMIT.slice(0, 7)}`);
    expect(screen.queryByTestId("git-info-branch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("git-info-ci")).not.toBeInTheDocument();
  });

  it("copies complete branch and commit values when repository links are unavailable", async () => {
    const branch = "feature/" + "long-branch".repeat(20);
    (getReportOptions as Mock).mockReturnValue({ git: { branch, commit: COMMIT } });
    render(<GitInfo />);
    expect(screen.getByTestId("git-info-branch")).toHaveTextContent(branch);
    fireEvent.click(screen.getByTestId("git-info-branch"));
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(branch));
    fireEvent.click(screen.getByTestId("git-info-commit"));
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(COMMIT));
  });

  it.each([
    [true, "clipboardSuccess"],
    [false, "clipboardError"],
  ])("reports clipboard outcome %s without claiming a failed copy succeeded", async (copied, feedback) => {
    (getReportOptions as Mock).mockReturnValue({ git: { commit: COMMIT } });
    (copyToClipboard as Mock).mockResolvedValue(copied);
    render(<GitInfo />);
    const button = screen.getByTestId("git-info-commit");

    fireEvent.mouseEnter(button.parentElement.parentElement);
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(feedback as string)).toBeInTheDocument());
    expect(copyToClipboard).toHaveBeenCalledWith(COMMIT);
  });

  it("keeps repository navigation and full SHA copying available together", async () => {
    (getReportOptions as Mock).mockReturnValue({
      ci: {
        provider: "github",
        repository: { slug: "a/b", url: "https://example.com/a/b" },
        jobRunBranch: "feature/x",
      },
      git: { commit: COMMIT },
    });
    render(<GitInfo />);
    expect(screen.getByTestId("git-info-branch")).toHaveAttribute("href", "https://example.com/a/b/tree/feature/x");
    expect(screen.getByTestId("git-info-commit")).toHaveAttribute("href", `https://example.com/a/b/commit/${COMMIT}`);
    expect(screen.getByTestId("git-info-commit")).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(screen.getByRole("button", { name: "clipboard: gitCommit" }));
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith(COMMIT));
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
