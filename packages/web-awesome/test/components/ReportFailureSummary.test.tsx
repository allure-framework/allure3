import { cleanup, render, screen, within } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { ReportFailureSummary } from "@/components/ReportFailureSummary";
import { reportStatsStore } from "@/stores";
import { globalsStore } from "@/stores/globals";
import { qualityGateStore } from "@/stores/qualityGate";

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("ReportFailureSummary");
  await label("coverage", "global-errors");

  reportStatsStore.value = {
    loading: false,
    error: undefined,
    data: { total: 0 },
  };
  qualityGateStore.value = {
    loading: false,
    error: undefined,
    data: {},
  };
  globalsStore.value = {
    loading: false,
    error: undefined,
    data: {
      errors: [],
      attachments: [],
    },
  };
});

afterEach(() => {
  cleanup();
});

describe("components > ReportFailureSummary", () => {
  it("does not render when the report has no failures", () => {
    render(<ReportFailureSummary />);

    expect(screen.queryByTestId("report-failure-summary")).not.toBeInTheDocument();
  });

  it("renders when only a quality gate fails", () => {
    qualityGateStore.value = {
      loading: false,
      error: undefined,
      data: {
        default: [
          {
            rule: "maxFailures",
            message: "Too many failures",
            success: false,
            expected: 0,
            actual: 1,
            testResults: ["failed-1"],
          },
        ],
      },
    };

    render(<ReportFailureSummary />);

    expect(screen.getByTestId("report-failure-summary")).toBeInTheDocument();
    expect(within(screen.getByTestId("failure-summary-failed-quality-gates")).getByTestId("counter")).toHaveTextContent(
      "1",
    );
  });

  it("renders when only a global error exists", () => {
    globalsStore.value = {
      loading: false,
      error: undefined,
      data: {
        errors: [{ message: "Runner crashed" }],
        attachments: [],
      },
    };

    render(<ReportFailureSummary />);

    expect(screen.getByTestId("report-failure-summary")).toBeInTheDocument();
    expect(within(screen.getByTestId("failure-summary-global-errors")).getByTestId("counter")).toHaveTextContent("1");
  });

  it("does not render or throw when store data is undefined", () => {
    reportStatsStore.value = { loading: false, error: undefined, data: undefined as never };
    qualityGateStore.value = { loading: false, error: undefined, data: undefined };
    globalsStore.value = { loading: false, error: undefined, data: undefined };

    expect(() => render(<ReportFailureSummary />)).not.toThrow();
    expect(screen.queryByTestId("report-failure-summary")).not.toBeInTheDocument();
  });

  it("summarizes unsuccessful tests, failed quality gates, and global errors", () => {
    reportStatsStore.value = {
      loading: false,
      error: undefined,
      data: {
        total: 6,
        passed: 3,
        failed: 2,
        broken: 1,
      },
    };
    qualityGateStore.value = {
      loading: false,
      error: undefined,
      data: {
        default: [
          {
            rule: "maxFailures",
            message: "Too many failures",
            success: false,
            expected: 0,
            actual: 2,
            testResults: ["failed-1", "failed-2"],
          },
          {
            rule: "maxDuration",
            message: "Duration is acceptable",
            success: true,
            expected: 500,
            actual: 100,
            testResults: [],
          },
        ],
        production: [
          {
            rule: "successRate",
            message: "Success rate is too low",
            success: false,
            expected: 90,
            actual: 50,
            testResults: ["failed-1", "failed-2", "broken-1"],
          },
        ],
      },
    };
    globalsStore.value = {
      loading: false,
      error: undefined,
      data: {
        errors: [{ message: "Runner crashed" }, { message: "Cleanup failed" }],
        attachments: [],
      },
    };

    render(<ReportFailureSummary />);

    const unsuccessfulTests = screen.getByTestId("failure-summary-unsuccessful-tests");
    const failedQualityGates = screen.getByTestId("failure-summary-failed-quality-gates");
    const globalErrors = screen.getByTestId("failure-summary-global-errors");

    expect(within(unsuccessfulTests).getByTestId("counter")).toHaveTextContent("3");
    expect(unsuccessfulTests).toHaveTextContent("failureSummary.unsuccessfulTests");
    expect(within(failedQualityGates).getByTestId("counter")).toHaveTextContent("2");
    expect(failedQualityGates).toHaveTextContent("failureSummary.failedQualityGates");
    expect(within(globalErrors).getByTestId("counter")).toHaveTextContent("2");
    expect(globalErrors).toHaveTextContent("failureSummary.globalErrors");
  });
});
