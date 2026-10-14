import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollapseAll } from "@/components/ReportBody/CollapseAll";

const { allTreesCollapsed, allTreesExpanded, hasCollapsibleTrees, setAllTreesOpened } = vi.hoisted(() => ({
  allTreesCollapsed: { value: false },
  allTreesExpanded: { value: false },
  hasCollapsibleTrees: { value: true },
  setAllTreesOpened: vi.fn(),
}));

vi.mock("@/stores/tree", () => ({ allTreesCollapsed, allTreesExpanded, hasCollapsibleTrees, setAllTreesOpened }));
vi.mock("@/stores/locale", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("CollapseAll");
  await label("coverage", "ui-components");
  vi.clearAllMocks();
  cleanup();
  allTreesCollapsed.value = false;
  allTreesExpanded.value = false;
  hasCollapsibleTrees.value = true;
});

describe("components > ReportBody > CollapseAll", () => {
  it("offers to expand everything when every group is collapsed", () => {
    allTreesCollapsed.value = true;

    render(<CollapseAll />);

    const button = screen.getByTestId("collapse-all-button");

    expect(button.getAttribute("aria-label")).toBe("expandAll");

    fireEvent.click(button);

    expect(setAllTreesOpened).toHaveBeenCalledWith(true);
  });

  it("offers to collapse everything when every group is expanded", () => {
    allTreesExpanded.value = true;

    render(<CollapseAll />);

    const button = screen.getByTestId("collapse-all-button");

    expect(button.getAttribute("aria-label")).toBe("collapseAll");

    fireEvent.click(button);

    expect(setAllTreesOpened).toHaveBeenCalledWith(false);
  });

  it("says that a part of the groups is expanded and collapses them when the groups are in the mixed state", () => {
    render(<CollapseAll />);

    const button = screen.getByTestId("collapse-all-button");

    expect(button.getAttribute("aria-label")).toBe("collapseAllPartial");

    fireEvent.click(button);

    expect(setAllTreesOpened).toHaveBeenCalledWith(false);
  });

  it("renders nothing when there are no groups to collapse", () => {
    hasCollapsibleTrees.value = false;

    const { container } = render(<CollapseAll />);

    expect(container.innerHTML).toBe("");
  });
});
