import { getReportOptions } from "@allurereport/web-commons";
import { render, screen } from "@testing-library/preact";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportHeader } from "@/components/ReportHeader";

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: vi.fn(),
}));

vi.mock("@allurereport/web-components", () => ({
  Heading: (props: { children: string }) => <h2>{props.children}</h2>,
  Loadable: (props: { renderData: (data: unknown) => unknown }) => props.renderData({}),
  Text: (props: { "children": unknown; "data-testid"?: string }) => (
    <span data-testid={props["data-testid"]}>{props.children}</span>
  ),
  TooltipWrapper: (props: { children: unknown }) => props.children,
}));

vi.mock("@/components/ReportHeader/ReportHeaderLogo", () => ({
  ReportHeaderLogo: () => <div data-testid="report-logo" />,
}));

vi.mock("@/components/ReportHeader/ReportHeaderPie", () => ({
  ReportHeaderPie: () => <div data-testid="report-pie" />,
}));

vi.mock("@/components/TestResult/TrStatus", () => ({
  TrStatus: () => <div data-testid="tr-status" />,
}));

vi.mock("@/stores", () => ({
  useI18n: () => ({
    t: (key: string, params: Record<string, unknown>) => `${key}: ${params.formattedCreatedAt}`,
  }),
}));

vi.mock("@/utils/time", () => ({
  timestampToDate: (value: number, options?: Intl.DateTimeFormatOptions) =>
    `${options?.month === "long" ? "long" : "default"}:${value}`,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("components > ReportHeader", () => {
  it("should render launch start time and duration when run summary is available", () => {
    (getReportOptions as Mock).mockReturnValue({
      reportName: "Wrike report",
      createdAt: 42,
      runSummary: {
        start: 1000,
        stop: 2500,
        duration: 1500,
      },
    });

    render(<ReportHeader />);

    expect(screen.getByTestId("report-data")).toHaveTextContent("long:1000");
    expect(screen.getByTestId("report-data")).not.toHaveTextContent("long:2500");
    expect(screen.getByTestId("report-data")).not.toHaveTextContent("long:42");
  });

  it("should fall back to generated time when run summary is missing", () => {
    (getReportOptions as Mock).mockReturnValue({
      reportName: "Wrike report",
      createdAt: 10,
    });

    render(<ReportHeader />);

    expect(screen.getByTestId("report-data")).toHaveTextContent("long:10");
  });
});
