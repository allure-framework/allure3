import { act, cleanup, renderHook } from "@testing-library/preact";
import { epic, feature, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "ResizeObserver",
  vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
);

import { ESTIMATE_ROW_HEIGHT, useVirtualList } from "../../../src/components/VirtualTree/useVirtualList.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("virtual-tree");
  await story("useVirtualList");
});

afterEach(() => cleanup());

const OVERSCAN = 2;

function makeScrollEl(initialScrollTop = 0, clientHeight = 200): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-tree-scroll-container", "");
  let _scrollTop = initialScrollTop;
  Object.defineProperty(el, "scrollTop", {
    get: () => _scrollTop,
    set: (v) => {
      _scrollTop = v;
    },
  });
  Object.defineProperty(el, "clientHeight", { value: clientHeight });
  Object.defineProperty(el, "getBoundingClientRect", {
    value: () => ({ top: 0, bottom: clientHeight, left: 0, right: 0, width: 0, height: clientHeight }),
  });
  return el;
}

function makeContainerEl(scrollEl: HTMLElement): HTMLElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "getBoundingClientRect", {
    value: () => {
      const scrollTop = (scrollEl as any).scrollTop as number;
      return { top: -scrollTop, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    },
  });
  scrollEl.appendChild(el);
  return el;
}

describe("useVirtualList — own scroll container", () => {
  it("renders initial visible items covering the viewport", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result } = renderHook(() => useVirtualList(containerRef, 100, OVERSCAN, true));

    const visibleWithoutOverscan = Math.ceil(200 / ESTIMATE_ROW_HEIGHT);
    const expected = visibleWithoutOverscan + OVERSCAN;
    expect(result.current.virtualItems.length).toBeGreaterThanOrEqual(expected);
    expect(result.current.virtualItems[0]!.index).toBe(0);
    document.body.removeChild(el);
  });

  it("first item starts at offset 0", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result } = renderHook(() => useVirtualList(containerRef, 50, OVERSCAN, true));

    expect(result.current.virtualItems[0]!.start).toBe(0);
    document.body.removeChild(el);
  });

  it("totalSize equals count * ESTIMATE_ROW_HEIGHT before any measurements", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result } = renderHook(() => useVirtualList(containerRef, 50, OVERSCAN, true));

    expect(result.current.totalSize).toBe(50 * ESTIMATE_ROW_HEIGHT);
    document.body.removeChild(el);
  });

  it("shifts visible window when scroll position changes", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result } = renderHook(() => useVirtualList(containerRef, 100, OVERSCAN, true));

    const initialFirst = result.current.virtualItems[0]!.index;
    expect(initialFirst).toBe(0);

    act(() => {
      (el as any).scrollTop = 10 * ESTIMATE_ROW_HEIGHT;
      el.dispatchEvent(new Event("scroll"));
    });

    const afterScrollFirst = result.current.virtualItems[0]!.index;
    expect(afterScrollFirst).toBeGreaterThan(0);
    document.body.removeChild(el);
  });

  it("item starts track cumulative height of preceding items", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result } = renderHook(() => useVirtualList(containerRef, 50, OVERSCAN, true));

    const items = result.current.virtualItems;
    for (let i = 1; i < items.length; i++) {
      expect(items[i]!.start).toBe(items[i - 1]!.start + ESTIMATE_ROW_HEIGHT);
    }
    document.body.removeChild(el);
  });

  it("returns no items when count is 0", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result } = renderHook(() => useVirtualList(containerRef, 0, OVERSCAN, true));

    expect(result.current.virtualItems).toHaveLength(0);
    expect(result.current.totalSize).toBe(0);
    document.body.removeChild(el);
  });

  it("scrollToIndex sets scrollTop to item position (align: start)", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result } = renderHook(() => useVirtualList(containerRef, 100, OVERSCAN, true));

    act(() => result.current.scrollToIndex(20, "start"));

    expect((el as any).scrollTop).toBe(20 * ESTIMATE_ROW_HEIGHT);
    document.body.removeChild(el);
  });

  it("scrollToIndex does not scroll when item is already visible (align: auto)", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result } = renderHook(() => useVirtualList(containerRef, 100, OVERSCAN, true));

    act(() => result.current.scrollToIndex(1, "auto"));

    expect((el as any).scrollTop).toBe(0);
    document.body.removeChild(el);
  });

  it("totalSize updates after measureElement provides actual heights", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result } = renderHook(() => useVirtualList(containerRef, 10, OVERSCAN, true));

    const itemEl = document.createElement("div");
    itemEl.setAttribute("data-index", "0");
    Object.defineProperty(itemEl, "getBoundingClientRect", { value: () => ({ height: 48 }) });

    act(() => {
      result.current.measureElement(itemEl);
      // measureElement updates a ref only; trigger re-render by changing scroll state
      (el as any).scrollTop = 1;
      el.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.totalSize).toBe(48 + 9 * ESTIMATE_ROW_HEIGHT);
    document.body.removeChild(el);
  });
});

describe("useVirtualList — external scroll container", () => {
  it("finds and uses [data-tree-scroll-container] ancestor as scroll element", () => {
    const scrollEl = makeScrollEl(0, 300);
    const containerEl = makeContainerEl(scrollEl);
    document.body.appendChild(scrollEl);
    const containerRef = { current: containerEl };

    const { result } = renderHook(() => useVirtualList(containerRef, 50, OVERSCAN, false));

    expect(result.current.virtualItems.length).toBeGreaterThan(0);
    document.body.removeChild(scrollEl);
  });

  it("responds to scroll events on the external container", () => {
    const scrollEl = makeScrollEl(0, 200);
    const containerEl = makeContainerEl(scrollEl);
    document.body.appendChild(scrollEl);
    const containerRef = { current: containerEl };

    const { result } = renderHook(() => useVirtualList(containerRef, 100, OVERSCAN, false));

    act(() => {
      (scrollEl as any).scrollTop = 5 * ESTIMATE_ROW_HEIGHT;
      scrollEl.dispatchEvent(new Event("scroll"));
    });

    const firstIndex = result.current.virtualItems[0]!.index;
    expect(firstIndex).toBeGreaterThan(0);
    document.body.removeChild(scrollEl);
  });
});

describe("useVirtualList — count changes", () => {
  it("clears measured heights when count changes", () => {
    const el = makeScrollEl(0, 200);
    document.body.appendChild(el);
    const containerRef = { current: el };

    const { result, rerender } = renderHook(({ count }) => useVirtualList(containerRef, count, OVERSCAN, true), {
      initialProps: { count: 10 },
    });

    const itemEl = document.createElement("div");
    itemEl.setAttribute("data-index", "0");
    Object.defineProperty(itemEl, "getBoundingClientRect", { value: () => ({ height: 64 }) });
    act(() => {
      result.current.measureElement(itemEl);
      (el as any).scrollTop = 1;
      el.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.totalSize).toBe(64 + 9 * ESTIMATE_ROW_HEIGHT);

    rerender({ count: 5 });
    expect(result.current.totalSize).toBe(5 * ESTIMATE_ROW_HEIGHT);
    document.body.removeChild(el);
  });
});
