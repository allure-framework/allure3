import { useEffect, useRef, useState } from "preact/hooks";

const ESTIMATE_ROW_HEIGHT = 32;

export type VirtualItem = { index: number; start: number };

export type VirtualListResult = {
  totalSize: number;
  virtualItems: VirtualItem[];
  measureElement: (el: HTMLElement | null) => void;
  scrollToIndex: (index: number, align?: "start" | "center" | "auto") => void;
};

export function useVirtualList(
  scrollElementRef: { current: HTMLElement | null },
  count: number,
  overscan: number,
): VirtualListResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const measuredHeights = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return;

    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setContainerHeight(el.clientHeight);

    setContainerHeight(el.clientHeight);
    setScrollTop(el.scrollTop);

    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  const getOffset = (idx: number) => {
    let offset = 0;
    for (let i = 0; i < idx; i++) {
      offset += measuredHeights.current.get(i) ?? ESTIMATE_ROW_HEIGHT;
    }
    return offset;
  };

  const getTotalSize = () => {
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
    virtualItems.push({ index: i, start: getOffset(i) });
  }

  const measureElement = (el: HTMLElement | null) => {
    if (!el) return;
    const indexAttr = el.getAttribute("data-index");
    if (indexAttr === null) return;
    const idx = parseInt(indexAttr, 10);
    if (isNaN(idx)) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0 && measuredHeights.current.get(idx) !== h) {
      measuredHeights.current.set(idx, h);
    }
  };

  const scrollToIndex = (index: number, align: "start" | "center" | "auto" = "auto") => {
    const el = scrollElementRef.current;
    if (!el) return;
    const itemStart = getOffset(index);
    const itemHeight = measuredHeights.current.get(index) ?? ESTIMATE_ROW_HEIGHT;
    if (align === "start") {
      el.scrollTop = itemStart;
    } else if (align === "center") {
      el.scrollTop = itemStart - el.clientHeight / 2 + itemHeight / 2;
    } else {
      if (itemStart < el.scrollTop) {
        el.scrollTop = itemStart;
      } else if (itemStart + itemHeight > el.scrollTop + el.clientHeight) {
        el.scrollTop = itemStart + itemHeight - el.clientHeight;
      }
    }
  };

  return { totalSize: getTotalSize(), virtualItems, measureElement, scrollToIndex };
}
