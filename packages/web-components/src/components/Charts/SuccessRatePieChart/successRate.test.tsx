import { getPieChartValues } from "@allurereport/web-commons";
import { fireEvent, render, cleanup, waitFor } from "@testing-library/preact";
import { attachment, step } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SuccessRatePieChart } from "./index";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("success rate pie interaction", () => {
  it("separates success and slice denominators and supports focus, Escape, hover and cleanup", async () => {
    const stats = { total: 633, passed: 493, failed: 45, skipped: 95 };
    const view = render(<SuccessRatePieChart {...getPieChartValues(stats)} />);
    const caption = view.getByRole("img", { name: "Success rate: 91.63%" });

    await attachment("input statistics", JSON.stringify(stats), "application/json");
    await step("Caption and passed slice describe different denominators", async () => {
      expect(caption.textContent).toBe("91.63%");
      expect(view.getByRole("img", { name: /493 [Pp]assed \(77.88% of all tests\)/ })).toBeTruthy();

      const description = document.getElementById(caption.getAttribute("aria-describedby")!);

      expect(description?.textContent).toContain("Skipped and unknown tests are excluded.");

      (caption as HTMLElement).focus();

      await waitFor(() => expect(document.querySelector('[role="tooltip"]')?.textContent).toContain("91.63%"));

      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => expect(document.querySelector('[role="tooltip"]')).toBeNull());

      (caption as HTMLElement).blur();
      fireEvent.mouseEnter(caption);

      await waitFor(() => expect(document.querySelector('[role="tooltip"]')).not.toBeNull());

      const tooltip = document.querySelector('[role="tooltip"]')!;

      fireEvent.mouseLeave(caption);
      fireEvent.mouseEnter(tooltip);
      await new Promise((resolve) => setTimeout(resolve, 120));

      expect(document.querySelector('[role="tooltip"]')).not.toBeNull();

      fireEvent.mouseLeave(tooltip);

      await waitFor(() => expect(document.querySelector('[role="tooltip"]')).toBeNull());
    });
    await attachment("rendered chart", view.container.innerHTML, "text/html");

    view.unmount();

    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(document.querySelector('[id^="P"]')).toBeNull();
  });

  it.each([
    { stats: { total: 0 }, caption: "???", description: "There are no test results." },
    {
      stats: { total: 3, skipped: 2, unknown: 1 },
      caption: "0%",
      description: "There are no passed, failed, or broken tests.",
    },
    { stats: { total: 1, broken: 1 }, caption: "0%", description: "Calculated from passed, failed, and broken tests." },
    {
      stats: { total: 2, passed: 1, skipped: 1 },
      caption: "100%",
      description: "Calculated from passed, failed, and broken tests.",
    },
  ])("distinguishes state for $stats", ({ stats, caption, description }) => {
    const view = render(<SuccessRatePieChart {...getPieChartValues(stats)} />);
    const target = view.getByRole("img", { name: `Success rate: ${caption}` });

    expect(target.textContent).toBe(caption);
    expect(document.getElementById(target.getAttribute("aria-describedby")!)?.textContent).toContain(description);
  });
});
