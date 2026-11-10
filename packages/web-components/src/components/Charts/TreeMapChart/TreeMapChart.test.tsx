import type { TreeMapNode } from "@allurereport/charts-api";
import { ResponsiveTreeMap } from "@nivo/treemap";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { story } from "allure-js-commons";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { TreeMapChart } from "./TreeMapChart.js";

vi.hoisted(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
});

vi.mock("@nivo/treemap", () => ({
  ResponsiveTreeMap: vi.fn(({ data }: { data: TreeMapNode<{ successRateText?: string }> }) => (
    <svg>
      {data.children?.map((node) => (
        <rect key={node.id} aria-label={node.successRateText} tabindex={0} />
      ))}
    </svg>
  )),
}));

beforeEach(async () => {
  await story("Success rate distribution tooltip performance");
  vi.clearAllMocks();
});
afterEach(cleanup);

it("updates and dismisses the tooltip without rendering the treemap again", async () => {
  const data: TreeMapNode<{ successRateText?: string }> = {
    id: "root",
    successRateText: "Root success rate",
    children: [
      { id: "first", value: 1, successRateText: "First success rate" },
      { id: "second", value: 1, successRateText: "Second success rate" },
    ],
  };
  render(<TreeMapChart data={data} colors={() => "green"} showLegend={false} />);
  const renders = vi.mocked(ResponsiveTreeMap).mock.calls.length;
  const first = screen.getByLabelText("First success rate");
  const second = screen.getByLabelText("Second success rate");

  fireEvent.mouseMove(first, { clientX: 20, clientY: 20 });
  expect((await screen.findByRole("tooltip")).textContent).toBe("First success rate");
  fireEvent.mouseMove(second, { clientX: 40, clientY: 20 });
  expect((await screen.findByRole("tooltip")).textContent).toBe("Second success rate");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();

  (first as unknown as HTMLElement).focus();
  expect((await screen.findByRole("tooltip")).textContent).toBe("First success rate");
  expect(ResponsiveTreeMap).toHaveBeenCalledTimes(renders);
});
