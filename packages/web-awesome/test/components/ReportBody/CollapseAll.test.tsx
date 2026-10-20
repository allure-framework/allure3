import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { CollapseAll } from "@/components/ReportBody/CollapseAll";

const {
  allTreesCollapsed,
  allTreesExpanded,
  canResetTreesToDefault,
  hasCollapsibleTrees,
  resetTreesToDefault,
  setAllTreesOpened,
} = vi.hoisted(() => ({
  allTreesCollapsed: { value: false },
  allTreesExpanded: { value: false },
  canResetTreesToDefault: { value: true },
  hasCollapsibleTrees: { value: true },
  resetTreesToDefault: vi.fn(),
  setAllTreesOpened: vi.fn(),
}));

vi.mock("@/stores/tree", () => ({
  allTreesCollapsed,
  allTreesExpanded,
  canResetTreesToDefault,
  hasCollapsibleTrees,
  resetTreesToDefault,
  setAllTreesOpened,
}));
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
  canResetTreesToDefault.value = true;
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

  it("goes back to the default view when every group is expanded", () => {
    allTreesExpanded.value = true;

    render(<CollapseAll />);

    const button = screen.getByTestId("collapse-all-button");

    expect(button.getAttribute("aria-label")).toBe("collapseToDefault");

    fireEvent.click(button);

    expect(resetTreesToDefault).toHaveBeenCalledTimes(1);
    expect(setAllTreesOpened).not.toHaveBeenCalled();
  });

  it("collapses everything when every group is expanded by default", () => {
    allTreesExpanded.value = true;
    canResetTreesToDefault.value = false;

    render(<CollapseAll />);

    const button = screen.getByTestId("collapse-all-button");

    expect(button.getAttribute("aria-label")).toBe("collapseAll");

    fireEvent.click(button);

    expect(setAllTreesOpened).toHaveBeenCalledWith(false);
    expect(resetTreesToDefault).not.toHaveBeenCalled();
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
