import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import type { ComponentProps } from "preact";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/components/SvgIcon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/SvgIcon")>();

  return {
    ...actual,
    SvgIcon: (props: ComponentProps<typeof actual.SvgIcon>) => (
      <span data-testid={props["data-testid"]} data-icon-id={props.id} />
    ),
  };
});

import { allureIcons } from "@/components/SvgIcon";

import { TreeItemInfo } from "./index";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TreeItemInfo", () => {
  it("renders distinct resolution markers with their corresponding tooltips", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<TreeItemInfo />);
    const expectResolution = async (
      resolution: "issue" | "muted" | "accepted",
      tooltip: string,
      expectedIconId: string,
    ) => {
      rerender(<TreeItemInfo resolution={resolution} tooltips={{ resolution: tooltip }} />);
      const marker = screen.getByTestId(`tree-leaf-resolution-${resolution}`);
      const wrapper = marker.parentElement!.parentElement!;

      expect(marker.getAttribute("data-icon-id")).toBe(expectedIconId);

      fireEvent.mouseEnter(wrapper);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(screen.getByTestId("tree-leaf-resolution-tooltip").textContent).toBe(tooltip);
      fireEvent.mouseLeave(wrapper);
    };

    await expectResolution("issue", "Issue", allureIcons.lineDevBug2);
    await expectResolution("muted", "Muted", allureIcons.lineGeneralEye);
    await expectResolution("accepted", "Accepted", allureIcons.lineGeneralCheckCircle);

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

  it("shows the start and stop timestamps on the duration when the report carries them", async () => {
    vi.useFakeTimers();
    render(<TreeItemInfo duration={1608} tooltips={{ duration: "Start: one\nStop: two" }} />);

    const duration = screen.getByTestId("tree-leaf-duration");
    const trigger = duration.parentElement!.parentElement!;

    expect(duration.textContent).toBe("1s 608ms");

    await act(async () => {
      trigger.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("tree-leaf-duration-tooltip").textContent).toBe("Start: one\nStop: two");
  });

  it("renders the duration without a tooltip when the report has no timestamps", () => {
    render(<TreeItemInfo duration={1608} />);

    expect(screen.getByTestId("tree-leaf-duration").textContent).toBe("1s 608ms");
    expect(screen.queryByTestId("tree-leaf-duration-tooltip")).toBeNull();
  });
});
