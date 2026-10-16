import { cleanup, render, screen, within } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportFailureSummary } from "@/components/ReportFailureSummary";
import { reportStatsStore } from "@/stores";
import { globalsStore } from "@/stores/globals";
import { qualityGateStore } from "@/stores/qualityGate";

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      key === "failureSummary.exitCode" ? `Process exited with code ${params?.code}.` : key,
  }),
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("ReportFailureSummary");
  await label("coverage", "ui-components");

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
  it("does not render for a clean report", () => {
    globalsStore.value = {
      loading: false,
      error: undefined,
      data: {
        exitCode: { original: 1, actual: 0 },
        errors: [],
        attachments: [],
      },
    };

    render(<ReportFailureSummary />);

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
          { rule: "maxFailures", message: "Too many failures", success: false },
          { rule: "maxDuration", message: "Duration is acceptable", success: true },
        ],
        production: [{ rule: "successRate", message: "Success rate is too low", success: false }],
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
    expect(screen.queryByText(/Process exited with code/)).not.toBeInTheDocument();
  });

  it("shows the effective exit code when it is the only failure signal", () => {
    globalsStore.value = {
      loading: false,
      error: undefined,
      data: {
        exitCode: { original: 7 },
        errors: [],
        attachments: [],
      },
    };

    render(<ReportFailureSummary />);

    expect(screen.getByTestId("report-failure-summary")).toBeInTheDocument();
    expect(screen.getByText("Process exited with code 7.")).toBeInTheDocument();
    expect(screen.getAllByTestId("counter")).toHaveLength(3);
    screen.getAllByTestId("counter").forEach((counter) => expect(counter).toHaveTextContent("0"));
  });
});
