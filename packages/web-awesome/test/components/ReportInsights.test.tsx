import { cleanup, render, screen, within } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { splitMode } = vi.hoisted(() => ({
  splitMode: { value: false },
}));

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key} ${Object.values(values).join(" ")}` : key),
  }),
}));
vi.mock("@/stores/reportRootTabs", () => ({
  REPORT_ROOT_TAB: { Results: "results", GlobalErrors: "globalErrors", QualityGate: "qualityGate" },
}));
vi.mock("@/stores/layout", () => ({ isSplitMode: splitMode }));

import { ReportInsights, getFailedInsightsCount } from "@/components/ReportInsights";
import { currentEnvironment } from "@/stores/env";
import { externalChecksStore } from "@/stores/externalChecks";
import { globalsStore } from "@/stores/globals";
import { metricsStore } from "@/stores/metrics";
import { qualityGateStore } from "@/stores/qualityGate";
import { reportStatsStore, statsByEnvStore } from "@/stores/stats";

beforeEach(() => {
  vi.clearAllMocks();
  splitMode.value = false;
  currentEnvironment.value = "";
  reportStatsStore.value = {
    loading: false,
    data: { total: 10, failed: 1, broken: 1, passed: 7, skipped: 1 },
  };
  statsByEnvStore.value = { loading: false, data: {} };
  metricsStore.value = {
    loading: false,
    data: {
      current: [
        { id: "slow", key: "slow", value: 20, better: "lower", start: 0, stop: 1 },
        { id: "fast", key: "fast", value: 5, better: "lower", start: 0, stop: 1 },
      ],
      history: [{ uuid: "before", name: "Before", timestamp: 1, metrics: { slow: 10, fast: 10 } }],
    },
  };
  globalsStore.value = {
    loading: false,
    data: { errors: [{ message: "Database unavailable" }], attachments: [] },
  };
  qualityGateStore.value = {
    loading: false,
    data: {
      default: [
        {
          success: false,
          expected: 0,
          actual: 2,
          rule: "maxFailures",
          message: "Too many failed tests",
          testResults: [],
        },
      ],
    },
  };
  externalChecksStore.value = {
    loading: false,
    data: {
      lint: {
        id: "lint",
        name: "ESLint",
        status: "passed",
        details: { command: "yarn lint", message: "No violations", url: "https://example.com/checks/lint" },
      },
      security: {
        id: "security",
        name: "Dependabot",
        status: "failed",
        details: {
          command: "dependabot",
          error: "High severity vulnerability",
          url: "https://example.com/checks/security",
        },
      },
    },
  };
});

afterEach(cleanup);

describe("components > ReportInsights", () => {
  it("counts the insight cards that need attention", () => {
    expect(getFailedInsightsCount()).toBe(5);
  });

  it("renders focused insight cards without breakdowns or extra rule and error details", () => {
    render(<ReportInsights />);

    expect(screen.getByTestId("insights-view")).toBeInTheDocument();
    expect(screen.queryByTestId("report-failure-summary")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "insights.title" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^insight-/)).toHaveLength(6);
    expect(screen.getByTestId("insight-tests")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByTestId("insight-tests")).toHaveTextContent("insights.tests.summary");
    expect(screen.getByTestId("insight-tests")).not.toHaveTextContent("insights.tests.failed");
    expect(screen.getByTestId("insight-tests")).not.toHaveTextContent("insights.tests.broken");
    expect(screen.getByTestId("insight-tests")).not.toHaveTextContent("insights.tests.passed");
    expect(screen.getByTestId("insight-tests")).not.toHaveTextContent("insights.tests.skipped");
    expect(screen.getByTestId("insight-performance")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByTestId("insight-performance")).toHaveTextContent("insights.performance.summary");
    expect(screen.getByTestId("insight-performance")).not.toHaveTextContent("insights.performance.regressed");
    expect(screen.getByTestId("insight-performance")).not.toHaveTextContent("insights.performance.improved");
    expect(screen.getByTestId("insight-global-errors")).not.toHaveTextContent("Database unavailable");
    expect(screen.getByTestId("insight-global-errors")).toHaveTextContent("insights.globalErrors.summary");
    expect(screen.getByTestId("insight-global-errors")).not.toHaveTextContent("insights.globalErrors.reported");
    expect(screen.getByTestId("insight-quality-gates")).not.toHaveTextContent("Too many failed tests");
    expect(screen.getByTestId("insight-quality-gates")).toHaveTextContent("insights.qualityGates.summary");
    expect(screen.getByTestId("insight-quality-gates")).not.toHaveTextContent("insights.qualityGates.failed");
    expect(screen.getByTestId("insight-quality-gates")).not.toHaveTextContent("insights.qualityGates.passed");
  });

  it("renders failed external checks first with linked titles", () => {
    render(<ReportInsights />);

    expect(screen.queryByTestId("insight-external-checks")).not.toBeInTheDocument();
    const cards = screen.getAllByTestId(/^insight-external-check-/);
    expect(cards.map((card) => card.getAttribute("data-testid"))).toEqual([
      "insight-external-check-security",
      "insight-external-check-lint",
    ]);
    expect(cards[0]).toHaveTextContent("Dependabot");
    expect(cards[0]).toHaveTextContent("High severity vulnerability");
    expect(cards[0]).not.toHaveAttribute("href");
    expect(within(cards[0]).getByRole("link", { name: "Dependabot" })).toHaveAttribute(
      "href",
      "https://example.com/checks/security",
    );
    expect(within(cards[0]).getByRole("link", { name: "Dependabot" })).toHaveAttribute("target", "_blank");
    expect(within(cards[0]).getByRole("link", { name: "Dependabot" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(cards[1]).toHaveTextContent("ESLint");
    expect(cards[1]).toHaveTextContent("No violations");
    expect(cards[1]).not.toHaveAttribute("href");
    expect(within(cards[1]).getByRole("link", { name: "ESLint" })).toHaveAttribute(
      "href",
      "https://example.com/checks/lint",
    );
  });

  it("does not link an external check with an unsafe URL", () => {
    externalChecksStore.value.data!.lint.details!.url = "javascript:alert(1)";

    render(<ReportInsights />);

    expect(within(screen.getByTestId("insight-external-check-lint")).queryByRole("link")).not.toBeInTheDocument();
  });

  it("marks the insight grid for a single-column split layout", () => {
    splitMode.value = true;

    render(<ReportInsights />);

    expect(screen.getByTestId("insights-view")).toHaveAttribute("data-layout", "split");
  });

  it("links summary card titles to their detailed report views", () => {
    render(<ReportInsights />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("insight-tests")).getByRole("link", { name: "insights.tests.title" }),
    ).toHaveAttribute("href", "#results");
    expect(
      within(screen.getByTestId("insight-performance")).getByRole("link", { name: "insights.performance.title" }),
    ).toHaveAttribute("href", "#metrics");
    expect(
      within(screen.getByTestId("insight-global-errors")).getByRole("link", { name: "insights.globalErrors.title" }),
    ).toHaveAttribute("href", "#globalErrors");
    expect(
      within(screen.getByTestId("insight-quality-gates")).getByRole("link", { name: "insights.qualityGates.title" }),
    ).toHaveAttribute("href", "#qualityGate");
  });
});
