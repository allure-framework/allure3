import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { treeTags, matchMediaMock } = vi.hoisted(() => {
  const matchMediaMock = vi.fn().mockImplementation(() => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  vi.stubGlobal("matchMedia", matchMediaMock);

  return {
    treeTags: { value: [] as string[] },
    matchMediaMock,
  };
});

vi.mock("@/stores", () => ({
  useI18n: (namespace: string) => ({
    t: (key: string) => `${namespace}.${key}`,
  }),
}));

vi.mock("@/stores/locale", () => ({
  useI18n: (namespace: string) => ({
    t: (key: string) => `${namespace}.${key}`,
  }),
}));

vi.mock("@/stores/treeFilters/store", () => ({
  treeTags,
}));

import { TagsFilter } from "@/components/ReportFilters/TagsFilter";
import type { AwesomeArrayFieldFilter } from "@/stores/treeFilters/model";

const createFilter = (value: string[] = []): AwesomeArrayFieldFilter => ({
  type: "field",
  value: {
    type: "array",
    key: "tags",
    value,
  },
});

describe("components > ReportFilters > TagsFilter", () => {
  afterEach(() => {
    cleanup();
    treeTags.value = [];
    vi.useRealTimers();
  });

  beforeEach(() => {
    matchMediaMock.mockClear();
    treeTags.value = ["REQ-1234", "REQ-1235", "smoke"];
    vi.useFakeTimers();
  });

  it("filters tags by case-insensitive partial search", async () => {
    render(<TagsFilter filter={createFilter()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("filters.tags"));
    fireEvent.input(screen.getByTestId("search-input"), { target: { value: "req-1235" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.queryByText("REQ-1234")).not.toBeInTheDocument();
    expect(screen.getByText("REQ-1235")).toBeInTheDocument();
    expect(screen.queryByText("smoke")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    render(<TagsFilter filter={createFilter()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("filters.tags"));
    fireEvent.input(screen.getByTestId("search-input"), { target: { value: "missing-tag" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByText("empty.no-results")).toBeInTheDocument();
    expect(screen.queryByText("REQ-1234")).not.toBeInTheDocument();
  });

  it("resets search when the dropdown closes", async () => {
    render(<TagsFilter filter={createFilter()} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText("filters.tags"));
    fireEvent.input(screen.getByTestId("search-input"), { target: { value: "smoke" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.queryByText("REQ-1234")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("filters.tags"));

    await waitFor(() => {
      expect(screen.queryByTestId("search-input")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("filters.tags"));

    expect(screen.getByTestId("search-input")).toHaveValue("");
    expect(screen.getByText("REQ-1234")).toBeInTheDocument();
    expect(screen.getByText("REQ-1235")).toBeInTheDocument();
    expect(screen.getByText("smoke")).toBeInTheDocument();
  });
});
