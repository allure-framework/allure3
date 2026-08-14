import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import type { AwesomeKnownIssues, AwesomeTestResult } from "types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportKnownIssues } from "@/components/ReportKnownIssues";
import { TrKnownIssuesView } from "@/components/TestResult/TrKnownIssues";

afterEach(() => {
  cleanup();
});

const navigateToTestResultMock = vi.hoisted(() => vi.fn());
const knownIssuesStoreMock = vi.hoisted(() => ({
  value: {
    loading: false,
    error: undefined,
    data: {
      issues: [],
      testResultsByIssueId: {},
    },
  },
}));

vi.mock("@allurereport/web-components", () => ({
  ArrowButton: ({ isOpened, onClick }: { isOpened: boolean; onClick: () => void }) => (
    <button aria-label={isOpened ? "collapse" : "expand"} onClick={onClick} type="button" />
  ),
  Loadable: ({ source, renderData }: { source: { value: { data: unknown } }; renderData: (data: any) => unknown }) =>
    renderData(source.value.data),
  PageLoader: () => <div>Loading</div>,
  SvgIcon: () => <span data-testid="known-issue-icon" />,
  Text: ({ children, tag: Tag = "div", ...rest }: { children: ComponentChildren; tag?: any }) => (
    <Tag {...rest}>{children}</Tag>
  ),
  TreeItem: ({
    name,
    status,
    duration,
    known,
    navigateTo,
  }: {
    name: string;
    status: string;
    duration?: number;
    known?: boolean;
    navigateTo: () => void;
  }) => (
    <button aria-label={name} onClick={navigateTo} type="button">
      <span data-testid={`status-icon-${status}`} />
      {known && <span data-testid="known-marker" />}
      <span>{name}</span>
      {duration !== undefined && <span>{duration}</span>}
    </button>
  ),
  allureIcons: {
    lineKnownIssues: "known-issues-icon",
    lineDevBug2: "bug-icon",
    lineGeneralChecklist3: "tms-icon",
    lineGeneralLink1: "link-icon",
    github: "github-icon",
  },
}));

vi.mock("@/stores", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/stores/knownIssues", () => ({
  knownIssuesStore: knownIssuesStoreMock,
}));

vi.mock("@/stores/router", () => ({
  navigateToTestResult: navigateToTestResultMock,
}));

beforeEach(() => {
  navigateToTestResultMock.mockClear();
  knownIssuesStoreMock.value = {
    loading: false,
    error: undefined,
    data: {
      issues: [],
      testResultsByIssueId: {},
    },
  };
});

describe("components > KnownIssues", () => {
  it("should render report-level known issues and navigate to linked test result", () => {
    const knownIssuesData: AwesomeKnownIssues = {
      issues: [
        {
          id: "issue-1",
          reason: "BUG-1 checkout issue",
          links: [{ name: "BUG-1", url: "https://example.com/BUG-1", type: "issue" }],
        },
      ],
      testResultsByIssueId: {
        "issue-1": [
          {
            id: "tr-1",
            name: "checkout fails",
            status: "failed",
            duration: 123,
            historyId: "history-1",
            flaky: false,
            known: true,
            retry: false,
          },
        ],
      },
    };

    knownIssuesStoreMock.value = {
      loading: false,
      error: undefined,
      data: knownIssuesData,
    };

    render(<ReportKnownIssues />);

    expect(screen.getByText("BUG-1 checkout issue")).toBeInTheDocument();
    expect(screen.getByText("BUG-1")).toHaveAttribute("href", "https://example.com/BUG-1");
    expect(screen.getByTestId("status-icon-failed")).toBeInTheDocument();
    expect(screen.getByTestId("known-marker")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "collapse" }));

    expect(screen.queryByRole("button", { name: /checkout fails/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "expand" }));

    fireEvent.click(screen.getByRole("button", { name: /checkout fails/i }));

    expect(navigateToTestResultMock).toHaveBeenCalledWith({ testResultId: "tr-1" });
  });

  it("should render known issue tab content for a test result", () => {
    const testResult = {
      id: "tr-1",
      name: "checkout fails",
      status: "failed",
      knownIssues: [
        {
          id: "issue-1",
          reason: "BUG-1 checkout issue",
          links: [{ name: "BUG-1", url: "https://example.com/BUG-1", type: "issue" }],
        },
        {
          id: "issue-2",
          reason: "BUG-2 payment issue",
          links: [{ name: "BUG-2", url: "https://example.com/BUG-2", type: "issue" }],
        },
      ],
    } as AwesomeTestResult;

    render(<TrKnownIssuesView testResult={testResult} />);

    expect(screen.getByText("BUG-1 checkout issue")).toBeInTheDocument();
    expect(screen.getByText("BUG-1")).toHaveAttribute("href", "https://example.com/BUG-1");
    expect(screen.getByText("BUG-2 payment issue")).toBeInTheDocument();
    expect(screen.getByText("BUG-2")).toHaveAttribute("href", "https://example.com/BUG-2");
  });
});
