import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

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

import { EnvironmentPicker } from "./index";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("EnvironmentPicker");
  await label("coverage", "ui-components");
});

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

const pickerProps = {
  environments: [
    { id: "default", name: "default" },
    { id: "long-environment", name: longEnvironmentName },
  ],
  value: "long-environment",
  onChange: vi.fn(),
  labels: { environment: "Environment", all: "All" },
};

describe("components > EnvironmentPicker", () => {
  let setNarrowViewport: (isNarrow: boolean) => void;
  let restoreElementSizeMocks: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
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
  });

  afterEach(() => {
    restoreElementSizeMocks();
    vi.unstubAllGlobals();
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("should show tooltip on hover after resize truncates selected value", async () => {
    render(<EnvironmentPicker {...pickerProps} />);
    const getPickerButton = () => screen.getByTestId("environment-picker-button");
    const getTooltipTrigger = () => getPickerButton().parentElement?.parentElement as HTMLElement;
    const queryTooltip = () => screen.queryByTestId("environment-picker-selected-tooltip");

    expect(queryTooltip()).toBeNull();

    await act(async () => {
      setNarrowViewport(true);
      fireEvent(window, new Event("resize"));
      await vi.advanceTimersByTimeAsync(16);
    });

    expect(getTooltipTrigger().childElementCount).toBe(2);

    const tooltipTrigger = getTooltipTrigger();
    fireEvent.mouseEnter(tooltipTrigger);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(queryTooltip()).not.toBeNull();

    await act(async () => {
      fireEvent.mouseLeave(tooltipTrigger);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(queryTooltip()).toBeNull();

    const button = getPickerButton();
    button.focus();
    fireEvent.click(button);
    expect(getPickerButton()).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(screen.queryAllByTestId("environment-picker-item")).toHaveLength(3);
    fireEvent.mouseEnter(getTooltipTrigger());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(queryTooltip()).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryAllByTestId("environment-picker-item")).toHaveLength(0);
  });
});

it("hides a picker with at most one environment", () => {
  for (const environments of [[], [pickerProps.environments[0]]]) {
    const { container, unmount } = render(<EnvironmentPicker {...pickerProps} environments={environments} />);
    expect(container.innerHTML).toBe("");
    unmount();
  }
});

it("uses the unknown id as label and preserves menu order and selection values", async () => {
  const onChange = vi.fn();
  render(<EnvironmentPicker {...pickerProps} value="unknown" onChange={onChange} />);
  expect(screen.getByTestId("environment-picker-button").textContent).toBe("unknown");
  fireEvent.click(screen.getByTestId("environment-picker-button"));
  const items = await screen.findAllByTestId("environment-picker-item");
  expect(items.map((item) => item.textContent)).toEqual(["All", "default", longEnvironmentName]);
  fireEvent.click(items[2].querySelector("button")!);
  expect(onChange).toHaveBeenLastCalledWith("long-environment");
  fireEvent.click(screen.getByTestId("environment-picker-button"));
  fireEvent.click((await screen.findAllByTestId("environment-picker-item"))[0].querySelector("button")!);
  expect(onChange).toHaveBeenLastCalledWith("");
  cleanup();
});
