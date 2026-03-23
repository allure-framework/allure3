import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { currentEnvironment, environmentsStore } from "@/stores/env";

const longEnvironmentName = "я".repeat(64);

const setElementSizeMocks = () => {
  let isNarrowViewport = false;
  const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const scrollWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      const textContent = this.textContent ?? "";

      if (textContent.includes(longEnvironmentName)) {
        return isNarrowViewport ? 120 : 420;
      }

      return 200;
    },
  });

  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get() {
      const textContent = this.textContent ?? "";

      if (textContent.includes(longEnvironmentName)) {
        return 300;
      }

      return 200;
    },
  });

  const setNarrowViewport = (isNarrow: boolean) => {
    isNarrowViewport = isNarrow;
  };

  const restore = () => {
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).clientWidth;
    }

    if (scrollWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "scrollWidth", scrollWidthDescriptor);
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollWidth;
    }
  };

  return {
    setNarrowViewport,
    restore,
  };
};

describe("components > EnvironmentPicker", () => {
  let setNarrowViewport: (isNarrow: boolean) => void;
  let restoreElementSizeMocks: () => void;

  beforeEach(() => {
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
    const controls = setElementSizeMocks();
    setNarrowViewport = controls.setNarrowViewport;
    restoreElementSizeMocks = controls.restore;
    currentEnvironment.value = "long-environment";
    environmentsStore.value = {
      loading: false,
      error: undefined,
      data: [
        { id: "default", name: "default" },
        { id: "long-environment", name: longEnvironmentName },
      ],
    };
  });

  afterEach(() => {
    restoreElementSizeMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("should show tooltip on hover after resize truncates selected value", async () => {
    const { EnvironmentPicker } = await import("@/components/EnvironmentPicker");

    render(<EnvironmentPicker />);
    const getPickerButton = () => screen.getByTestId("environment-picker-button");
    const getTooltipTrigger = () => getPickerButton().parentElement?.parentElement as HTMLElement;
    const queryTooltip = () => screen.queryByTestId("environment-picker-selected-tooltip");

    expect(queryTooltip()).not.toBeInTheDocument();

    setNarrowViewport(true);
    await waitFor(() => {
      fireEvent(window, new Event("resize"));
      expect(getTooltipTrigger().childElementCount).toBe(2);
    });

    const tooltipTrigger = getTooltipTrigger();
    fireEvent.mouseEnter(tooltipTrigger);
    await waitFor(() => {
      expect(queryTooltip()).toBeInTheDocument();
    });

    fireEvent.mouseLeave(tooltipTrigger);
    await waitFor(() => {
      expect(queryTooltip()).not.toBeInTheDocument();
    });

    fireEvent.click(getPickerButton());
    fireEvent.mouseEnter(getTooltipTrigger());

    expect(queryTooltip()).not.toBeInTheDocument();
  }, 15000);
});
