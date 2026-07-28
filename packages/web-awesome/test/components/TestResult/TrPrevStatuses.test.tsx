import type { HistoryTestResult } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { cleanup, render, screen } from "@testing-library/preact";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrPrevStatuses } from "@/components/TestResult/TrPrevStatuses";

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: vi.fn(),
}));

vi.mock("@allurereport/web-components", () => ({
  SvgIcon: (props: { id: string; className?: string }) => <span data-icon-id={props.id} className={props.className} />,
  Text: (props: { children: unknown; className?: string }) => <span className={props.className}>{props.children}</span>,
  TooltipWrapper: (props: { children: unknown }) => props.children,
  allureIcons: {
    lineShapesDotCircle: "dot-circle",
  },
}));

vi.mock("@/stores", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/utils/time", () => ({
  timestampToDate: (value: number) => `date:${value}`,
}));

const makeHistoryResult = (overrides: Partial<HistoryTestResult> = {}): HistoryTestResult => ({
  id: "5bd0de6d8fe94b75be93ae8ee778dd9e",
  name: "AdditionWorks",
  status: "passed",
  url: "http://127.0.0.1:58888/build-1",
  historyId: "addition-works-history",
  stop: 1000,
  duration: 20,
  reportLinks: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  (getReportOptions as Mock).mockReturnValue({ id: "awesome" });
});

describe("components > TestResult > TrPrevStatuses", () => {
  it("should link previous statuses through the current report plugin directory", () => {
    render(<TrPrevStatuses history={[makeHistoryResult({ url: "http://127.0.0.1:58888" })]} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "http://127.0.0.1:58888/awesome/#5bd0de6d8fe94b75be93ae8ee778dd9e",
    );
  });

  it("should render a non-link previous status for an invalid history url", () => {
    render(<TrPrevStatuses history={[makeHistoryResult({ url: "not-a-url" })]} />);

    expect(screen.getByTestId("test-result-prev-status")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
