import type { HistoryTestResult } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { cleanup, render, screen } from "@testing-library/preact";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrHistoryItem } from "@/components/TestResult/TrHistory/TrHistoryItem";

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: vi.fn(),
}));

vi.mock("@allurereport/web-components", () => ({
  ArrowButton: () => (
    <button aria-label="toggle history error" data-testid="test-result-history-item-arrow-button" type="button" />
  ),
  IconButton: (props: { href?: string; target?: string; onClick?: (event: Event) => void; className?: string }) => (
    <a href={props.href} target={props.target} className={props.className} onClick={props.onClick}>
      external
    </a>
  ),
  Text: (props: { children: unknown; className?: string }) => <span className={props.className}>{props.children}</span>,
  TooltipWrapper: (props: { children: unknown }) => props.children,
  TreeItemIcon: () => <span data-testid="history-status" />,
  allureIcons: {
    arrowsChevronDown: "chevron",
    lineGeneralLinkExternal: "external",
  },
}));

vi.mock("@/components/TestResult/TrError", () => ({
  TrError: () => <div data-testid="test-result-error" />,
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

describe("components > TestResult > TrHistoryItem", () => {
  it("should render links through the current report plugin directory", () => {
    render(<TrHistoryItem historyTr={makeHistoryResult({ url: "http://127.0.0.1:58888" })} />);

    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toContain(
      "http://127.0.0.1:58888/awesome/#5bd0de6d8fe94b75be93ae8ee778dd9e",
    );
  });

  it("should render a non-link row for an invalid history url", () => {
    render(<TrHistoryItem historyTr={makeHistoryResult({ url: "not-a-url" })} />);

    expect(screen.getByTestId("test-result-history-item")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
