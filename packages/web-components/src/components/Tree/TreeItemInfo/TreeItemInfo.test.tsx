import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { TreeItemInfo } from "./index";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TreeItemInfo", () => {
  it("renders the resolution category marker", () => {
    render(<TreeItemInfo resolution="issue" />);

    expect(screen.queryByTestId("tree-leaf-resolution-issue")).not.toBeNull();
  });

  it("renders distinct resolution markers with their corresponding tooltips", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<TreeItemInfo />);
    const iconSignatures: string[] = [];
    const expectResolution = async (resolution: "issue" | "muted" | "accepted", tooltip: string) => {
      rerender(<TreeItemInfo resolution={resolution} tooltips={{ resolution: tooltip }} />);
      const marker = screen.getByTestId(`tree-leaf-resolution-${resolution}`);
      const wrapper = marker.parentElement!.parentElement!;

      iconSignatures.push(marker.tagName === "IMG" ? marker.getAttribute("src")! : marker.innerHTML);

      fireEvent.mouseEnter(wrapper);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(screen.getByTestId("tree-leaf-resolution-tooltip").textContent).toBe(tooltip);
      fireEvent.mouseLeave(wrapper);
    };

    await expectResolution("issue", "Issue");
    await expectResolution("muted", "Muted");
    await expectResolution("accepted", "Accepted");
    expect(new Set(iconSignatures)).toHaveLength(3);

    rerender(<TreeItemInfo />);
    expect(screen.queryByTestId("tree-leaf-resolution-issue")).toBeNull();
    expect(screen.queryByTestId("tree-leaf-resolution-muted")).toBeNull();
    expect(screen.queryByTestId("tree-leaf-resolution-accepted")).toBeNull();
    expect(screen.queryByTestId("tree-leaf-resolution-tooltip")).toBeNull();
  });

  it("shows status change marker alongside retry count for changed retries", () => {
    const { rerender } = render(<TreeItemInfo retriesCount={2} retriesStatusChange />);

    expect(screen.queryByTestId("tree-leaf-retries")).not.toBeNull();
    expect(screen.queryByTestId("tree-leaf-retries-status-change")).not.toBeNull();

    rerender(<TreeItemInfo retriesCount={2} retriesStatusChange={false} />);

    expect(screen.queryByTestId("tree-leaf-retries")).not.toBeNull();
    expect(screen.queryByTestId("tree-leaf-retries-status-change")).toBeNull();
  });
});
