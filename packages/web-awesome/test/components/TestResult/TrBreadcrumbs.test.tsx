import { signal } from "@preact/signals";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { TrBreadcrumbs } from "@/components/TestResult/TrHeader/TrBreadcrumbs";
import { categoriesStore } from "@/stores/categories";
import { treeStore } from "@/stores/tree";

beforeEach(async () => {
  await epic("coverage");
  await feature("navigation");
  await story("TrBreadcrumbs");
  await label("coverage", "navigation");
});

const inCategories = signal(false);
const revealTreeNode = vi.fn();
const revealCategoryNode = vi.fn();
const navigateToRoot = vi.fn();
const navigateToCategoriesRoot = vi.fn();

vi.mock("@/stores/keyboard", () => ({
  revealTreeNode: (...args: unknown[]) => revealTreeNode(...args),
}));

const { splitMode } = vi.hoisted(() => {
  const { signal: hoistedSignal } = require("@preact/signals");

  return { splitMode: hoistedSignal(false) };
});

vi.mock("@/stores/layout", () => ({
  isSplitMode: splitMode,
}));

vi.mock("@/stores/router", async () => {
  const { computed } = await import("@preact/signals");

  return {
    categoriesRoute: computed(() => ({ matches: inCategories.value, params: {} })),
    navigateToRoot: () => navigateToRoot(),
    navigateToCategoriesRoot: () => navigateToCategoriesRoot(),
  };
});

vi.mock("@/stores/categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/categories")>();

  return {
    ...actual,
    revealCategoryNode: (...args: unknown[]) => revealCategoryNode(...args),
  };
});

const deepTree = {
  root: { groups: ["g0"], leaves: [] },
  groupsById: Object.fromEntries(
    Array.from({ length: 6 }, (_, level) => [
      `g${level}`,
      {
        nodeId: `g${level}`,
        name: `l${level}`,
        statistic: {},
        groups: level < 5 ? [`g${level + 1}`] : undefined,
        leaves: level === 5 ? ["tr-1"] : undefined,
      },
    ]),
  ),
  leavesById: { "tr-1": { nodeId: "tr-1", name: "shouldLogin" } },
};

const testResult = {
  id: "tr-1",
  name: "shouldLogin",
  breadcrumbs: [["legacy suite"]],
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  inCategories.value = false;
  splitMode.value = false;
  treeStore.value = {
    loading: false,
    error: undefined,
    data: {
      default: {
        root: { groups: ["parent"], leaves: [] },
        groupsById: {
          parent: { nodeId: "parent", name: "com.example", statistic: {}, groups: ["child"] },
          child: { nodeId: "child", name: "LoginTest", statistic: {}, leaves: ["tr-1"] },
        },
        leavesById: { "tr-1": { nodeId: "tr-1", name: "shouldLogin" } },
      },
    } as any,
  };
  categoriesStore.value = {
    loading: false,
    error: undefined,
    data: {
      roots: ["cat:1"],
      nodes: {
        "cat:1": { id: "cat:1", type: "category", name: "Product errors", childrenIds: ["group:1"] },
        "group:1": { id: "group:1", type: "group", name: "critical", childrenIds: ["tr-1"] },
        "tr-1": { id: "tr-1", type: "tr", name: "shouldLogin" },
      },
    } as any,
  };
});

const breadcrumbTexts = () =>
  screen.getAllByTestId("test-result-breadcrumb-button").map((button) => button.textContent);

describe("components > TrBreadcrumbs", () => {
  it("renders a clickable button per tree group", () => {
    render(<TrBreadcrumbs testResult={testResult} />);

    expect(breadcrumbTexts()).toEqual(["com.example", "LoginTest"]);
  });

  it("reveals the group in the tree and navigates to the root on click", () => {
    render(<TrBreadcrumbs testResult={testResult} />);

    fireEvent.click(screen.getAllByTestId("test-result-breadcrumb-button")[0]);

    expect(revealTreeNode).toHaveBeenCalledWith("parent");
    expect(navigateToRoot).toHaveBeenCalled();
  });

  it("follows the categories tree when the test result is opened from categories", () => {
    inCategories.value = true;

    render(<TrBreadcrumbs testResult={testResult} />);

    expect(breadcrumbTexts()).toEqual(["Product errors", "critical"]);
  });

  it("reveals the whole category path and navigates to the categories root on click", () => {
    inCategories.value = true;

    render(<TrBreadcrumbs testResult={testResult} />);

    fireEvent.click(screen.getAllByTestId("test-result-breadcrumb-button")[1]);

    expect(revealCategoryNode).toHaveBeenCalledWith(["cat:1", "group:1"]);
    expect(navigateToCategoriesRoot).toHaveBeenCalled();
  });

  it("keeps the test result open in split mode, only revealing the group", () => {
    splitMode.value = true;

    render(<TrBreadcrumbs testResult={testResult} />);

    fireEvent.click(screen.getAllByTestId("test-result-breadcrumb-button")[0]);

    expect(revealTreeNode).toHaveBeenCalledWith("parent");
    expect(navigateToRoot).not.toHaveBeenCalled();
  });

  it("collapses the middle of a long path, keeping the root and the two levels above the test", () => {
    treeStore.value = { loading: false, error: undefined, data: { default: deepTree } as any };

    render(<TrBreadcrumbs testResult={testResult} />);

    expect(breadcrumbTexts()).toEqual(["l0", "l4", "l5"]);
    expect(screen.getByTestId("test-result-breadcrumb-more")).toBeTruthy();
  });

  it("reveals a hidden level picked from the collapsed menu", () => {
    treeStore.value = { loading: false, error: undefined, data: { default: deepTree } as any };

    render(<TrBreadcrumbs testResult={testResult} />);
    fireEvent.click(screen.getByTestId("test-result-breadcrumb-more"));

    const hidden = screen.getAllByTestId("test-result-breadcrumb-hidden-item");

    expect(hidden.map((item) => item.textContent)).toEqual(["l1", "l2", "l3"]);

    fireEvent.click(hidden[1]);

    expect(revealTreeNode).toHaveBeenCalledWith("g2");
  });

  it("keeps every level when the path is short enough", () => {
    render(<TrBreadcrumbs testResult={testResult} />);

    expect(screen.queryByTestId("test-result-breadcrumb-more")).toBeNull();
  });

  it("falls back to the label breadcrumbs when the test result is not in the tree", () => {
    treeStore.value = { loading: false, error: undefined, data: {} };

    render(<TrBreadcrumbs testResult={testResult} />);

    expect(screen.queryAllByTestId("test-result-breadcrumb-button")).toHaveLength(0);
    expect(screen.getByText("legacy suite")).toBeTruthy();
  });
});
