import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import type { ReportResolutionCategories as ReportResolutionCategoriesData, ReportTestResult } from "types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportResolutionCategories } from "@/components/ReportResolutionCategories";
import { TrResolutionCategoriesView } from "@/components/TestResult/TrResolutionCategories";

afterEach(() => {
  cleanup();
});

const navigateToTestResultMock = vi.hoisted(() => vi.fn());
const treeItemMock = vi.hoisted(() => vi.fn());
const resolutionCategoriesStoreMock = vi.hoisted(() => ({
  value: {
    loading: false,
    error: undefined,
    data: {
      groups: [],
    },
  },
}));

vi.mock("@allurereport/web-components", () => {
  return {
    ArrowButton: ({ isOpened }: { isOpened: boolean }) => <span aria-label={isOpened ? "collapse" : "expand"} />,
    Loadable: ({ source, renderData }: { source: { value: { data: unknown } }; renderData: (data: any) => unknown }) =>
      renderData(source.value.data),
    PageLoader: () => <div>Loading</div>,
    SvgIcon: ({ id }: { id: string }) => <span data-testid={`resolution-icon-${id}`} />,
    Text: ({ children, tag: Tag = "div", ...rest }: { children: ComponentChildren; tag?: any }) => (
      <Tag {...rest}>{children}</Tag>
    ),
    TreeItem: (props: any) => {
      const { name, status, duration, resolution, navigateTo } = props;

      treeItemMock(props);

      return (
        <button aria-label={name} onClick={navigateTo} type="button">
          <span data-testid={`status-icon-${status}`} />
          {resolution && <span data-testid={`resolution-marker-${resolution}`} />}
          <span>{name}</span>
          {duration !== undefined && <span>{duration}</span>}
        </button>
      );
    },
    allureIcons: {
      lineDevBug2: "issue-icon",
      lineGeneralCheckCircle: "accepted-icon",
      lineGeneralEye: "muted-icon",
    },
  };
});

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

vi.mock("@/stores/resolutionCategories", () => ({
  resolutionCategoriesStore: resolutionCategoriesStoreMock,
}));

vi.mock("@/stores/router", () => ({
  navigateToTestResult: navigateToTestResultMock,
}));

beforeEach(() => {
  navigateToTestResultMock.mockClear();
  treeItemMock.mockClear();
  resolutionCategoriesStoreMock.value = {
    loading: false,
    error: undefined,
    data: {
      groups: [],
    },
  };
});

describe("components > ResolutionCategories", () => {
  it("should render report-level resolution categories and navigate to linked test result", () => {
    const resolutionCategoriesData: ReportResolutionCategoriesData = {
      groups: [
        {
          id: "issue:BUG-1",
          resolution: "issue",
          name: "BUG-1",
          comment: "Checkout discount is not applied",
          issue: {
            id: "BUG-1",
            type: "jira",
            comment: "Checkout discount is not applied",
          },
          testResults: [
            {
              nodeId: "tr-1",
              id: "history-1",
              name: "checkout fails",
              status: "failed",
              duration: 123,
              flaky: false,
              retry: false,
              resolution: "issue",
            },
          ],
        },
      ],
    };

    resolutionCategoriesStoreMock.value = {
      loading: false,
      error: undefined,
      data: resolutionCategoriesData,
    };

    render(<ReportResolutionCategories />);

    expect(screen.getByText("BUG-1")).toBeInTheDocument();
    expect(screen.getByText("jira")).toBeInTheDocument();
    expect(screen.getByText("Checkout discount is not applied")).toBeInTheDocument();
    expect(screen.getByTestId("resolution-icon-issue-icon")).toBeInTheDocument();
    expect(screen.getByTestId("status-icon-failed")).toBeInTheDocument();
    expect(screen.getByTestId("resolution-marker-issue")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(treeItemMock.mock.calls[0]?.[0]).not.toHaveProperty("nodeId");
    expect(treeItemMock.mock.calls[0]?.[0]).not.toHaveProperty("retry");
    expect(treeItemMock.mock.calls[0]?.[0]).not.toHaveProperty("fullName");

    fireEvent.click(screen.getByRole("button", { name: /BUG-1/i }));

    expect(screen.queryByRole("button", { name: /checkout fails/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /BUG-1/i }));
    fireEvent.click(screen.getByRole("button", { name: /checkout fails/i }));

    expect(navigateToTestResultMock).toHaveBeenCalledWith({ testResultId: "tr-1" });
  });

  it("should render resolution category tab content for a test result", () => {
    const testResult = {
      id: "tr-1",
      name: "checkout fails",
      status: "failed",
      resolution: "muted",
      resolutionComment: "Muted while infra is unstable",
    } as ReportTestResult;

    render(<TrResolutionCategoriesView testResult={testResult} />);

    expect(screen.getByText("resolutions.muted")).toBeInTheDocument();
    expect(screen.getByText("Muted while infra is unstable")).toBeInTheDocument();
    expect(screen.getByTestId("resolution-icon-muted-icon")).toBeInTheDocument();
  });
});
