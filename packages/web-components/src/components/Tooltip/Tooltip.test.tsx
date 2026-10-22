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

  it.each(["visible", "pending"])(
    "disabling a %s tooltip hides it without remounting its trigger or resuming an old timer",
    async (state) => {
      vi.useFakeTimers();
      const tooltip = (active: boolean) => (
        <TooltipWrapper tooltipText="Details" isTriggerActive={active} data-testid="details">
          <button>Trigger</button>
        </TooltipWrapper>
      );
      const { rerender } = render(tooltip(true));
      const button = screen.getByRole("button", { name: "Trigger" });
      const wrapper = button.parentElement!.parentElement!;
      fireEvent.mouseEnter(wrapper);
      if (state === "visible") {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });
        expect(screen.queryByTestId("details")).not.toBeNull();
      }
      rerender(tooltip(false));
      expect(screen.queryByTestId("details")).toBeNull();
      expect(screen.getByRole("button", { name: "Trigger" })).toBe(button);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      rerender(tooltip(true));
      expect(screen.queryByTestId("details")).toBeNull();
      fireEvent.mouseEnter(wrapper);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(screen.queryByTestId("details")).not.toBeNull();
    },
  );
});
