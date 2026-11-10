import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import type { ComponentChildren } from "preact";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("SectionPicker");
  await label("coverage", "ui-components");
});

import { SectionPicker } from "@/components/SectionPicker";
import { setSection } from "@/stores/sections";

vi.mock("@allurereport/web-components/core", () => {
  const Menu = (props: { size?: string; menuTrigger: (p: object) => unknown; children: ComponentChildren }) => (
    <div data-testid="menu" data-size={props.size}>
      {props.menuTrigger({ isOpened: false, onClick: () => {} })}
      {props.children}
    </div>
  );

  Menu.Section = (props: { children: ComponentChildren }) => <>{props.children}</>;
  Menu.ItemWithCheckmark = (props: {
    children: ComponentChildren;
    isChecked: boolean;
    leadingIcon?: string;
    leadingIconFilled?: boolean;
    onClick: () => void;
  }) => (
    <button
      data-testid="section"
      data-checked={String(props.isChecked)}
      data-icon={props.leadingIcon}
      data-filled={String(Boolean(props.leadingIconFilled))}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );

  return {
    Menu,
    DropdownButton: (props: { text: string; icon?: string }) => (
      <button data-testid="trigger" data-icon={props.icon}>
        {props.text}
      </button>
    ),
    allureIcons: {
      reportLogo: "report-logo",
      lineChartsBarChartSquare: "bar-chart",
      lineChartsTimeline: "timeline",
    },
  };
});
vi.mock("@/stores", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
// the available sections of the store are a plain array, the current section is a signal
const currentSectionMock = vi.hoisted(() => ({ value: "default" }));
vi.mock("@/stores/sections", () => ({
  availableSections: ["charts", "timeline", "metrics"],
  currentSection: currentSectionMock,
  setSection: vi.fn(),
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  currentSectionMock.value = "default";
});

describe("components > SectionPicker", () => {
  it("should render the compact menu with the report and the available sections", () => {
    render(<SectionPicker />);

    expect(screen.getByTestId("menu").getAttribute("data-size")).toBe("xs");
    expect(screen.getAllByTestId("section").map((item) => item.textContent)).toEqual([
      "report",
      "charts",
      "timeline",
      "metrics",
    ]);
  });

  it("should show the title and the icon of the current section in the trigger", () => {
    currentSectionMock.value = "timeline";

    render(<SectionPicker />);

    expect(screen.getByTestId("trigger").textContent).toBe("timeline");
    expect(screen.getByTestId("trigger").getAttribute("data-icon")).toBe("timeline");
  });

  it("should fall back to the report for an unknown section", () => {
    currentSectionMock.value = "unknown";

    render(<SectionPicker />);

    expect(screen.getByTestId("trigger").textContent).toBe("report");
  });

  it("should check only the current section", () => {
    currentSectionMock.value = "charts";

    render(<SectionPicker />);

    expect(screen.getAllByTestId("section").map((item) => item.getAttribute("data-checked"))).toEqual([
      "false",
      "true",
      "false",
      "false",
    ]);
  });

  it("should scale down the logo of the report, which fills its whole icon, and only it", () => {
    render(<SectionPicker />);

    const [report, ...others] = screen.getAllByTestId("section");

    expect(report.getAttribute("data-icon")).toBe("report-logo");
    expect(report.getAttribute("data-filled")).toBe("true");
    expect(others.map((item) => item.getAttribute("data-filled"))).toEqual(["false", "false", "false"]);
  });

  it("should set the section picked in the menu", () => {
    render(<SectionPicker />);

    fireEvent.click(screen.getAllByTestId("section")[2]);

    expect(setSection as Mock).toHaveBeenCalledWith("timeline");
  });

  it("should set the default section for the report", () => {
    currentSectionMock.value = "charts";

    render(<SectionPicker />);
    fireEvent.click(screen.getAllByTestId("section")[0]);

    expect(setSection as Mock).toHaveBeenCalledWith("default");
  });
});
