import { cleanup, render, screen, within } from "@testing-library/preact";
import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { ReportFailureSummary } from "@/components/ReportFailureSummary";

beforeEach(async () => {
  await story("ReportFailureSummary");
});
beforeEach(() => {
  cleanup();
});

const items = [
  { count: 3, label: "Unsuccessful tests", testId: "failure-summary-unsuccessful-tests" },
  { count: 0, label: "Failed quality gates", testId: "failure-summary-failed-quality-gates" },
];

describe("ReportFailureSummary", () => {
  it("renders an alert labelled by the passed title", () => {
    render(<ReportFailureSummary title="Report failed" items={items} />);

    const alert = screen.getByRole("alert", { name: "Report failed" });

    expect(alert.getAttribute("data-testid")).toBe("report-failure-summary");
  });

  it("renders every item with its count and label", () => {
    render(<ReportFailureSummary title="Report failed" items={items} />);

    const unsuccessful = screen.getByTestId("failure-summary-unsuccessful-tests");
    const qualityGates = screen.getByTestId("failure-summary-failed-quality-gates");

    expect(within(unsuccessful).getByTestId("counter").textContent).toBe("3");
    expect(unsuccessful.textContent).toContain("Unsuccessful tests");
    expect(within(qualityGates).getByTestId("counter").textContent).toBe("0");
    expect(qualityGates.textContent).toContain("Failed quality gates");
  });

  it("passes the class name to the root element", () => {
    render(<ReportFailureSummary title="Report failed" items={items} className="custom" />);

    expect(screen.getByTestId("report-failure-summary").classList.contains("custom")).toBe(true);
  });
});
