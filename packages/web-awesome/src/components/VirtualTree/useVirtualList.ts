import { useEffect, useRef, useState } from "preact/hooks";

export const ESTIMATE_ROW_HEIGHT = 32;

export type VirtualItem = { index: number; start: number };

export type VirtualListResult = {
  totalSize: number;
  virtualItems: VirtualItem[];
  measureElement: (el: HTMLElement | null) => void;
  scrollToIndex: (index: number, align?: "start" | "center" | "auto") => void;
};

type ScrollContext = {
  scrollEl: HTMLElement;
  getContainerOffset: () => number;
};

function findScrollContainer(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    if (node.hasAttribute("data-tree-scroll-container")) return node;
    node = node.parentElement;
  }
  return null;
}

export function useVirtualList(
  containerRef: { current: HTMLElement | null },
  count: number,
  overscan: number,
  ownScrollContainer: boolean,
): VirtualListResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const measuredHeights = useRef<Map<number, number>>(new Map());
  const scrollCtxRef = useRef<ScrollContext | null>(null);
  const prevCountRef = useRef(count);

  if (prevCountRef.current !== count) {
    prevCountRef.current = count;
    measuredHeights.current.clear();
  }

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const scrollEl = ownScrollContainer ? containerEl : findScrollContainer(containerEl);
    if (!scrollEl) return;

    const getContainerOffset = (): number => {
      if (scrollEl === containerEl) return 0;
      return containerEl.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    };

    scrollCtxRef.current = { scrollEl, getContainerOffset };

    const update = () => {
      const offset = getContainerOffset();
      setScrollTop(Math.max(0, scrollEl.scrollTop - offset));
      setContainerHeight(scrollEl.clientHeight);
    };

    update();
    scrollEl.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener("scroll", update);
      ro.disconnect();
      scrollCtxRef.current = null;
    };
  }, []);

  const getItemOffset = (idx: number): number => {
    let offset = 0;
    for (let i = 0; i < idx; i++) {
      offset += measuredHeights.current.get(i) ?? ESTIMATE_ROW_HEIGHT;
    }
    return offset;
  };

  const getTotalSize = (): number => {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += measuredHeights.current.get(i) ?? ESTIMATE_ROW_HEIGHT;
    }
    return total;
  };

  let startIdx = 0;
  {
    let accumulated = 0;
    for (let i = 0; i < count; i++) {
      const h = measuredHeights.current.get(i) ?? ESTIMATE_ROW_HEIGHT;
      if (accumulated + h > scrollTop) {
        startIdx = Math.max(0, i - overscan);
        break;
      }
      accumulated += h;
      if (i === count - 1) startIdx = Math.max(0, count - overscan);
    }
  }

  let endIdx = count - 1;
  {
    let accumulated = 0;
    let pastStart = false;
    for (let i = 0; i < count; i++) {
      const h = measuredHeights.current.get(i) ?? ESTIMATE_ROW_HEIGHT;
      if (i >= startIdx) pastStart = true;
      if (pastStart) accumulated += h;
      if (pastStart && accumulated > containerHeight) {
        endIdx = Math.min(count - 1, i + overscan);
        break;
      }
    }
  }

  const virtualItems: VirtualItem[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    virtualItems.push({ index: i, start: getItemOffset(i) });
  }

  const measureElement = (el: HTMLElement | null) => {
    if (!el) return;
    const idx = parseInt(el.getAttribute("data-index") ?? "", 10);
    if (isNaN(idx)) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0 && measuredHeights.current.get(idx) !== h) {
      measuredHeights.current.set(idx, h);
    }
  };

  const scrollToIndex = (index: number, align: "start" | "center" | "auto" = "auto") => {
    const ctx = scrollCtxRef.current;
    if (!ctx) return;
    const { scrollEl, getContainerOffset } = ctx;
    const containerOffset = getContainerOffset();
    const itemStart = getItemOffset(index) + containerOffset;
    const itemHeight = measuredHeights.current.get(index) ?? ESTIMATE_ROW_HEIGHT;
    if (align === "start") {
      scrollEl.scrollTop = itemStart;
    } else if (align === "center") {
      scrollEl.scrollTop = itemStart - scrollEl.clientHeight / 2 + itemHeight / 2;
    } else {
      if (itemStart < scrollEl.scrollTop) {
        scrollEl.scrollTop = itemStart;
      } else if (itemStart + itemHeight > scrollEl.scrollTop + scrollEl.clientHeight) {
        scrollEl.scrollTop = itemStart + itemHeight - scrollEl.clientHeight;
      }
    }
  };

  return { totalSize: getTotalSize(), virtualItems, measureElement, scrollToIndex };
}
