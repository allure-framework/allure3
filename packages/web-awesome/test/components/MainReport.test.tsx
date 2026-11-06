import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  focusTreePane: vi.fn(),
  navigateToInsights: vi.fn(),
  navigateToRoot: vi.fn(),
  navigateToRootTabRoot: vi.fn(),
  navigateToRootTabTestResult: vi.fn(),
  rootTabRoute: { value: { matches: false, params: {} as { rootTab?: string } } },
}));

vi.mock("@allurereport/web-components/core", () => ({
  Counter: ({ count, status }: { count: number; status?: string }) => <span data-status={status}>{count}</span>,
  Loadable: <T,>({
    source,
    renderData,
  }: {
    source: { value: { data: T } };
    renderData: (data: T) => ComponentChildren;
  }) => renderData(source.value.data),
  Text: ({ children }: { children: ComponentChildren }) => <span>{children}</span>,
}));
vi.mock("@/components/ReportBody", () => ({ ReportBody: () => <div data-testid="results-content" /> }));
vi.mock("@/components/ReportCategories", () => ({ ReportCategories: () => null }));
vi.mock("@/components/ReportFailureSummary", () => ({
  ReportFailureSummary: () => <div data-testid="global-failure-summary" />,
}));
vi.mock("@/components/ReportGlobalAttachments", () => ({ ReportGlobalAttachments: () => null }));
vi.mock("@/components/ReportGlobalErrors", () => ({ ReportGlobalErrors: () => null }));
vi.mock("@/components/ReportHeader", () => ({ ReportHeader: () => null }));
vi.mock("@/components/ReportInsights", () => ({
  getFailedInsightsCount: () => 5,
  ReportInsights: () => <div data-testid="insights-content" />,
}));
vi.mock("@/components/ReportMetadata", () => ({ ReportMetadata: () => null }));
vi.mock("@/components/ReportQualityGateResults", () => ({ ReportQualityGateResults: () => null }));
vi.mock("@/components/ReportResolutionCategories", () => ({ ReportResolutionCategories: () => null }));
vi.mock("@/stores", () => ({
  reportStatsStore: { value: { data: { total: 10 } } },
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/stores/categories", () => ({ categoriesStore: { value: { data: { roots: [] } } } }));
vi.mock("@/stores/env", () => ({ currentEnvironment: { value: "" } }));
vi.mock("@/stores/globals", () => ({
  globalsStore: { value: { data: { attachments: [], attachmentsByEnv: {}, errors: [], errorsByEnv: {} } } },
}));
vi.mock("@/stores/keyboard", () => ({ focusTreePane: mocks.focusTreePane }));
vi.mock("@/stores/layout", () => ({ isSplitMode: { value: false } }));
vi.mock("@/stores/qualityGate", () => ({ qualityGateStore: { value: { data: { default: [] } } } }));
vi.mock("@/stores/resolutionCategories", () => ({
  resolutionCategoriesStore: { value: { data: { groups: [] } } },
}));
vi.mock("@/stores/router", () => ({
  navigateToInsights: () => {
    mocks.rootTabRoute.value = { matches: false, params: {} };
    mocks.navigateToInsights();
  },
  navigateToRoot: () => {
    mocks.rootTabRoute.value = { matches: true, params: { rootTab: "results" } };
    mocks.navigateToRoot();
  },
  navigateToRootTabRoot: mocks.navigateToRootTabRoot,
  navigateToRootTabTestResult: mocks.navigateToRootTabTestResult,
  rootTabRoute: mocks.rootTabRoute,
}));
vi.mock("@/stores/testResult", () => ({
  currentTrId: { value: undefined },
  trCurrentTab: { value: "overview" },
}));

import MainReport from "@/components/MainReport";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rootTabRoute.value = { matches: false, params: {} };
});

afterEach(cleanup);

describe("components > MainReport", () => {
  it("renders Insights beside Results and selects Insights by default", () => {
    render(<MainReport />);

    const tabs = screen.getAllByRole("button");
    expect(tabs.slice(0, 2).map((tab) => tab.textContent)).toEqual(["insights 5", "results 10"]);
    expect(screen.getByRole("button", { name: "insights 5" }).querySelector("[data-status='failed']")).not.toBeNull();
    expect(tabs[0]).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("insights-content")).toBeInTheDocument();
    expect(screen.queryByTestId("results-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("global-failure-summary")).not.toBeInTheDocument();
  });

  it("opens Results as a neighboring report tab", () => {
    render(<MainReport />);

    fireEvent.click(screen.getByRole("button", { name: "results 10" }));

    expect(mocks.navigateToRoot).toHaveBeenCalledOnce();
    expect(screen.getByTestId("results-content")).toBeInTheDocument();
  });
});
