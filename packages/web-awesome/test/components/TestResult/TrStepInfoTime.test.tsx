import type { DefaultTestStepResult } from "@allurereport/core-api";
import { cleanup, render, screen } from "@testing-library/preact";
import type { ComponentChildren, VNode } from "preact";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { TrStepInfo } from "@/components/TestResult/TrSteps/TrStepInfo";
import { formatTimeRange } from "@/utils/time";

vi.mock("@allurereport/web-components/core", () => ({
  SvgIcon: () => <span />,
  Text: ({ children, tag: Tag = "span", ...rest }: { children?: ComponentChildren; tag?: any }) => (
    <Tag {...rest}>{children}</Tag>
  ),
  // the real wrapper renders `tooltipComponent` only while hovered; render it eagerly to inspect its content
  TooltipWrapper: ({ children, tooltipComponent }: { children?: ComponentChildren; tooltipComponent?: VNode }) => (
    <div data-testid="tooltip-wrapper">
      {children}
      {tooltipComponent}
    </div>
  ),
  Tooltip: ({ children, ...rest }: { children?: ComponentChildren }) => <div {...rest}>{children}</div>,
  allureIcons: new Proxy({}, { get: (_, key) => String(key) }),
}));

vi.mock("@/stores/locale", () => ({
  currentLocale: { value: "en" },
  currentLocaleIso: { value: "en-US" },
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  cleanup();
});

const step = (overrides: Partial<DefaultTestStepResult> = {}): DefaultTestStepResult => ({
  type: "step",
  name: "step",
  status: "passed",
  parameters: [],
  steps: [],
  ...overrides,
});

describe("components > TestResult > TrStepInfo time range", () => {
  const start = 1779887536194;
  const stop = 1779887537802;

  it("shows start and stop timestamps in the tooltip of the step duration", () => {
    render(<TrStepInfo item={step({ start, stop, duration: stop - start })} />);

    expect(screen.getByText("1s 608ms")).toBeInTheDocument();
    expect(screen.getByTestId("test-result-step-time-tooltip").textContent).toBe(formatTimeRange(start, stop));
  });

  it("shows the only known timestamp when the other one is missing", () => {
    render(<TrStepInfo item={step({ stop, duration: 1000 })} />);

    expect(screen.getByTestId("test-result-step-time-tooltip").textContent).toBe(formatTimeRange(undefined, stop));
  });

  it("renders the duration without a tooltip when the step has no timestamps", () => {
    render(<TrStepInfo item={step({ duration: 1000 })} />);

    expect(screen.getByText("1s 0ms")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-wrapper")).toBeNull();
    expect(screen.queryByTestId("test-result-step-time-tooltip")).toBeNull();
  });
});
