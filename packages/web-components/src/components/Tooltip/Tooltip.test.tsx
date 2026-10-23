import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { TooltipWrapper } from "@/components/Tooltip";

beforeEach(async () => {
  await story("Tooltip");
});
beforeEach(() => {
  cleanup();
});

describe("TooltipWrapper", () => {
  it("passes the classes to the outer element and to the element around the children", () => {
    render(
      <TooltipWrapper tooltipText="Tooltip" className="outer" triggerClassName="trigger">
        <span>Trigger</span>
      </TooltipWrapper>,
    );

    const trigger = screen.getByText("Trigger").parentElement;

    expect(trigger?.className).toBe("trigger");
    expect(trigger?.parentElement?.className).toBe("outer");
  });
});

describe("TooltipWrapper activation", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("gates inactive hover content without replacing the trigger", async () => {
    vi.useFakeTimers();
    const tooltip = (active: boolean) => (
      <TooltipWrapper tooltipText="Details" isTriggerActive={active} data-testid="details">
        <button>Trigger</button>
      </TooltipWrapper>
    );
    const { rerender } = render(tooltip(false));
    const button = screen.getByRole("button", { name: "Trigger" });
    const wrapper = button.parentElement!.parentElement!;
    fireEvent.mouseEnter(wrapper);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.queryByTestId("details")).toBeNull();
    rerender(tooltip(true));
    fireEvent.mouseEnter(wrapper);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.queryByTestId("details")).not.toBeNull();
    rerender(tooltip(false));
    expect(screen.queryByTestId("details")).toBeNull();
    expect(screen.getByRole("button", { name: "Trigger" })).toBe(button);
  });

  it("preserves the click auto-hide deadline across activation changes", async () => {
    vi.useFakeTimers();
    const tooltip = (active: boolean) => (
      <TooltipWrapper triggerMode="click" tooltipText="Details" isTriggerActive={active} data-testid="details">
        <button>Trigger</button>
      </TooltipWrapper>
    );
    const { rerender } = render(tooltip(true));
    const button = screen.getByRole("button", { name: "Trigger" });
    const wrapper = button.parentElement!.parentElement!;
    fireEvent.click(button);
    fireEvent.mouseLeave(wrapper);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    rerender(tooltip(false));
    expect(screen.queryByTestId("details")).toBeNull();
    rerender(tooltip(true));
    expect(screen.queryByTestId("details")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(screen.queryByTestId("details")).toBeNull();
    rerender(tooltip(false));
    rerender(tooltip(true));
    expect(screen.queryByTestId("details")).toBeNull();
  });
});
