import { fireEvent, render, screen } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { clearTreeFiltersMock, hasActiveTreeFiltersMock, setTreeFilterMock, treeQuickFiltersMock } = vi.hoisted(() => ({
  clearTreeFiltersMock: vi.fn(),
  hasActiveTreeFiltersMock: { value: false },
  setTreeFilterMock: vi.fn(),
  treeQuickFiltersMock: { value: [] as unknown[] },
}));

vi.mock("@/stores/treeFilters/store", () => ({
  clearTreeFilters: clearTreeFiltersMock,
  hasActiveTreeFilters: hasActiveTreeFiltersMock,
  setTreeFilter: setTreeFilterMock,
  treeQuickFilters: treeQuickFiltersMock,
}));

vi.mock("@/stores/treeFilters/utils", () => ({
  isCategoryFilter: () => false,
  isFlakyFilter: (filter: { id?: string }) => filter.id === "flaky",
  isResolutionFilter: () => false,
  isRetryFilter: (filter: { id?: string }) => filter.id === "retry",
  isSeverityFilter: () => false,
  isTagFilter: () => false,
  isTransitionFilter: (filter: { id?: string }) => filter.id === "transition",
}));

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ReportFilters/TransitionFilter", () => ({
  TransitionFilter: () => <div data-testid="transition-filter" />,
}));

vi.mock("@/components/ReportFilters/SeverityFilter", () => ({
  SeverityFilter: () => null,
}));

vi.mock("@/components/ReportFilters/ResolutionFilter", () => ({
  ResolutionFilter: () => null,
}));

vi.mock("@/components/ReportFilters/TagsFilter", () => ({
  TagsFilter: () => null,
}));

vi.mock("@/components/ReportFilters/CategoriesFilter", () => ({
  CategoriesFilter: () => null,
}));

vi.mock("@/components/ReportFilters/BaseFilters", () => ({
  BooleanFieldFilter: () => null,
}));

vi.mock("@allurereport/web-components", () => ({
  Button: (props: { text: string; onClick: () => void }) => (
    <button type="button" onClick={props.onClick}>
      {props.text}
    </button>
  ),
}));

import { ReportFilters } from "@/components/ReportFilters";

describe("components > ReportFilters", () => {
  beforeEach(() => {
    clearTreeFiltersMock.mockReset();
    setTreeFilterMock.mockReset();
    hasActiveTreeFiltersMock.value = false;
    treeQuickFiltersMock.value = [];
  });

  it("should hide clear filters button when no filters are active", () => {
    render(<ReportFilters />);

    expect(screen.queryByRole("button", { name: "clear-filters" })).not.toBeInTheDocument();
  });

  it("should show clear filters button when filters are active", () => {
    hasActiveTreeFiltersMock.value = true;

    render(<ReportFilters />);

    expect(screen.getByRole("button", { name: "clear-filters" })).toBeInTheDocument();
  });

  it("should reset filters when clear filters button is clicked", () => {
    hasActiveTreeFiltersMock.value = true;

    render(<ReportFilters />);

    fireEvent.click(screen.getByRole("button", { name: "clear-filters" }));

    expect(clearTreeFiltersMock).toHaveBeenCalledOnce();
  });

  it("should hide retry and flaky quick filters", () => {
    treeQuickFiltersMock.value = [{ id: "retry" }, { id: "flaky" }, { id: "transition" }];

    render(<ReportFilters />);

    expect(screen.queryByTestId("retry-filter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flaky-filter")).not.toBeInTheDocument();
    expect(screen.getByTestId("transition-filter")).toBeInTheDocument();
  });
});
