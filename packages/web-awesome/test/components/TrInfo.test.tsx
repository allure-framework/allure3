import { cleanup, render, screen } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrInfo } from "@/components/TestResult/TrInfo";

vi.mock("@allurereport/web-components", () => {
  return {
    Counter: ({ count }: { count: number }) => <span>{count}</span>,
    Heading: ({ children, tag: Tag = "h1", ...rest }: { children?: ComponentChildren; tag?: any }) => (
      <Tag {...rest}>{children}</Tag>
    ),
    Loadable: () => null,
    SvgIcon: ({ id, ...rest }: { id: string }) => <span data-icon-id={id} {...rest} />,
    Text: ({ children, tag: Tag = "div", ...rest }: { children?: ComponentChildren; tag?: any }) => (
      <Tag {...rest}>{children}</Tag>
    ),
    TooltipWrapper: ({ children, tooltipText }: { children?: ComponentChildren; tooltipText?: string }) => (
      <span title={tooltipText}>{children}</span>
    ),
    allureIcons: {
      lineArrowsSwitchVertical1: "lineArrowsSwitchVertical1",
    },
  };
});

vi.mock("@/components/TestResult/TrNavigation", () => ({
  TrNavigation: () => <div data-testid="test-result-navigation" />,
}));

vi.mock("@/components/TestResult/TrPrevStatuses", () => ({
  TrPrevStatuses: () => <div data-testid="test-result-prev-statuses" />,
}));

vi.mock("@/components/TestResult/TrSeverity", () => ({
  TrSeverity: ({ severity }: { severity: string }) => <div>{severity}</div>,
}));

vi.mock("@/components/TestResult/TrStatus", () => ({
  TrStatus: ({ status }: { status: string }) => <div>{status}</div>,
}));

vi.mock("@/components/TestResult/TrTabs", () => ({
  TrTab: ({ children, id }: { children?: ComponentChildren; id: string }) => (
    <button data-testid={`test-result-tab-${id}`}>{children}</button>
  ),
  TrTabsList: ({ children }: { children?: ComponentChildren }) => <div>{children}</div>,
}));

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  cleanup();
});

const testResult = {
  id: "tr",
  name: "changes status across retries",
  status: "passed",
  duration: 1,
  labels: [],
  history: [],
  retries: [],
  attachments: [],
  testCase: {
    id: "tc",
  },
};

describe("components > TrInfo", () => {
  it("renders retry status change as a test result mark", () => {
    render(<TrInfo testResult={{ ...testResult, retriesStatusChange: true } as any} />);

    const mark = screen.getByTestId("test-result-retries-status-change");

    expect(mark).toHaveTextContent("retriesStatusChange");
    expect(mark.parentElement).toHaveAttribute("title", "description.retriesStatusChange");
  });

  it("does not render retry status change mark when status is stable across retries", () => {
    render(<TrInfo testResult={{ ...testResult, retriesStatusChange: false } as any} />);

    expect(screen.queryByTestId("test-result-retries-status-change")).toBeNull();
  });
});
