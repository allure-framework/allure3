import { cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

import { ResolutionFilter } from "@/components/ReportFilters/ResolutionFilter";
import { currentEnvironment } from "@/stores/env";
import { treeStore } from "@/stores/tree";
import type { AwesomeFilterGroupSimple } from "@/stores/treeFilters/model";

import type { AwesomeTree, AwesomeTreeLeaf } from "../../types";

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const resolutionGroup = (resolutions: string[] = []): AwesomeFilterGroupSimple => ({
  type: "group",
  logicalOperator: "AND",
  fieldKey: "resolution",
  value: resolutions.map((resolution) => ({
    type: "field",
    logicalOperator: "OR",
    value: {
      key: "resolution",
      value: resolution,
      type: "string",
      strict: true,
    },
  })),
});

const leaf = (id: string, resolution?: AwesomeTreeLeaf["resolution"]): AwesomeTreeLeaf => ({
  id,
  nodeId: id,
  name: id,
  status: "failed",
  duration: 1,
  groupOrder: 1,
  resolution,
});

const tree = (leaves: AwesomeTreeLeaf[]): AwesomeTree =>
  ({
    root: { nodeId: "root", name: "root", children: [] },
    groupsById: {},
    leavesById: Object.fromEntries(leaves.map((item) => [item.nodeId, item])),
  }) as AwesomeTree;

const openResolutionFilter = () => {
  render(<ResolutionFilter group={resolutionGroup()} onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "resolution" }));
};

beforeEach(async () => {
  await epic("coverage");
  await feature("filters");
  await story("resolution-filter");
  await label("coverage", "ui-components");

  currentEnvironment.value = "";
  treeStore.value = {
    loading: false,
    error: undefined,
    data: {
      "env-a": tree([leaf("issue-1", "issue"), leaf("issue-2", "issue"), leaf("muted-1", "muted"), leaf("plain-1")]),
      "env-b": tree([leaf("accepted-1", "accepted"), leaf("muted-2", "muted")]),
    },
  };
});

afterEach(() => {
  cleanup();
  currentEnvironment.value = "";
  treeStore.value = { loading: true, error: undefined, data: undefined };
});

describe("components > ReportFilters > ResolutionFilter", () => {
  it("renders counters for each resolution category from loaded tree leaves", () => {
    openResolutionFilter();

    expect(within(screen.getByTestId("issue-filter")).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByTestId("muted-filter")).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByTestId("accepted-filter")).getByText("1")).toBeInTheDocument();
  });

  it("limits counters to the selected environment", () => {
    currentEnvironment.value = "env-b";

    openResolutionFilter();

    expect(within(screen.getByTestId("issue-filter")).getByText("0")).toBeInTheDocument();
    expect(within(screen.getByTestId("muted-filter")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("accepted-filter")).getByText("1")).toBeInTheDocument();
  });

  it("keeps counters independent from active resolution filters", () => {
    render(<ResolutionFilter group={resolutionGroup(["issue"])} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /resolution 1/ }));

    expect(within(screen.getByTestId("issue-filter")).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByTestId("muted-filter")).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByTestId("accepted-filter")).getByText("1")).toBeInTheDocument();
  });
});
