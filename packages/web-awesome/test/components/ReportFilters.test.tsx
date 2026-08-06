import { cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportFilters } from "@/components/ReportFilters";

const { getParamValueMock, getParamValuesMock, setParamsMock } = vi.hoisted(() => ({
  getParamValueMock: vi.fn(),
  getParamValuesMock: vi.fn(),
  setParamsMock: vi.fn(),
}));

vi.mock("@allurereport/web-components", () => {
  const Button = (props: { icon?: string; text: string; onClick: () => void; isDisabled?: boolean }) => (
    <button data-icon={props.icon} disabled={props.isDisabled} onClick={props.onClick} type="button">
      {props.text}
    </button>
  );

  const Menu = (props: {
    children: ComponentChildren;
    menuTrigger: (props: { isOpened: boolean; onClick: () => void }) => ComponentChildren;
  }) => (
    <div>
      {props.menuTrigger({ isOpened: false, onClick: () => {} })}
      {props.children}
    </div>
  );

  Menu.Section = (props: { children: ComponentChildren }) => <>{props.children}</>;
  Menu.ItemWithCheckmark = (props: { children: ComponentChildren }) => <div>{props.children}</div>;

  return {
    Button,
    Counter: (props: { count: number }) => <span>{props.count}</span>,
    DropdownButton: Button,
    IconButton: (props: { onClick: () => void }) => <button aria-label="clear" onClick={props.onClick} type="button" />,
    Menu,
    Text: (props: { children: ComponentChildren }) => <span>{props.children}</span>,
    Tooltip: (props: { children: ComponentChildren }) => <div>{props.children}</div>,
    allureIcons: {
      lineAlertsAlertCircle: "known-icon",
      lineAlertsFixed: "fixed-icon",
      lineKnownIssues: "known-issues-icon",
      lineAlertsMalfunctioned: "malfunctioned-icon",
      lineAlertsNew: "new-icon",
      lineAlertsRegressed: "regressed-icon",
      lineArrowsRefreshCcw1: "retry-icon",
      lineIconBomb2: "flaky-icon",
      solidXCircle: "clear-icon",
    },
    useTooltip: () => {},
  };
});

vi.mock("@allurereport/web-commons", async () => {
  const actual = await vi.importActual<typeof import("@allurereport/web-commons")>("@allurereport/web-commons");

  return {
    ...actual,
    getParamValue: getParamValueMock,
    getParamValues: getParamValuesMock,
    setParams: setParamsMock,
  };
});

const t = (key: string) =>
  ({
    "description.flaky": "Show unstable tests",
    "description.known": "Show known issue test results",
    "description.retry": "Show test results that were rerun",
    "flaky": "Flaky",
    "known": "Known issues",
    "retry": "Retry",
    "transition": "Transition",
  })[key] ?? key;

vi.mock("@/stores", () => ({
  useI18n: () => ({ t }),
}));

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({ t }),
}));

describe("components > ReportFilters", () => {
  beforeEach(() => {
    getParamValueMock.mockReset();
    getParamValuesMock.mockReset();
    setParamsMock.mockReset();
    getParamValueMock.mockReturnValue(undefined);
    getParamValuesMock.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("should render known issues quick filter and update known URL param on click", () => {
    render(<ReportFilters />);

    const knownFilter = screen.getByTestId("known-filter");
    const knownButton = within(knownFilter).getByRole("button", { name: "Known issues" });

    expect(knownButton).toHaveAttribute("data-icon", "known-issues-icon");

    fireEvent.click(knownButton);

    expect(setParamsMock).toHaveBeenCalledWith({
      key: "known",
      value: "true",
    });
  });
});
