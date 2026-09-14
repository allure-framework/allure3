import type { TreeNavNodeKind } from "./types.js";

export type ScrollRect = {
  top: number;
  bottom: number;
};

const isOutOfScrollport = (nodeRect: ScrollRect, rootRect: ScrollRect, inset: number) =>
  nodeRect.top < rootRect.top + inset || nodeRect.bottom > rootRect.bottom - inset;

/** Scroll delta for a focused row: groups/env pin to the top; leaves center when out of view. */
export const computeTreeFocusScrollDelta = (
  nodeRect: ScrollRect,
  rootRect: ScrollRect,
  kind?: TreeNavNodeKind,
  inset = 4,
): number => {
  const pinToTop = kind === "group" || kind === "env";

  if (!isOutOfScrollport(nodeRect, rootRect, inset)) {
    return 0;
  }

  if (pinToTop) {
    return nodeRect.top - rootRect.top - inset;
  }

  const nodeCenter = (nodeRect.top + nodeRect.bottom) / 2;
  const rootCenter = (rootRect.top + rootRect.bottom) / 2;

  return nodeCenter - rootCenter;
};

const isScrollableElement = (element: HTMLElement): boolean => {
  const { overflowY } = getComputedStyle(element);

  return (
    (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
    element.scrollHeight > element.clientHeight + 1
  );
};

/** Nearest marked scrollport that actually scrolls; skips decorative `data-*-scroll-container` wrappers. */
export const findFocusScrollRoot = (target: HTMLElement, containerAttribute: string): HTMLElement | null => {
  let node: Element | null = target.parentElement;
  let fallback: HTMLElement | null = null;

  while (node instanceof HTMLElement) {
    if (node.hasAttribute(containerAttribute)) {
      fallback ??= node;

      if (isScrollableElement(node)) {
        return node;
      }
    }

    node = node.parentElement;
  }

  return fallback;
};

export const scrollTreeFocusIntoView = (
  target: HTMLElement,
  scrollRoot: HTMLElement,
  kind?: TreeNavNodeKind,
  inset = 4,
): void => {
  const nodeRect = target.getBoundingClientRect();
  const rootRect = scrollRoot.getBoundingClientRect();
  const delta = computeTreeFocusScrollDelta(nodeRect, rootRect, kind, inset);

  if (Math.abs(delta) > 1) {
    const pinToTop = kind === "group" || kind === "env";

    if (pinToTop) {
      // Compute absolute content position so scrollTop never goes negative.
      // scrollTop += delta can clamp to 0, leaving the node behind the sticky header.
      const contentY = nodeRect.top - rootRect.top + scrollRoot.scrollTop;
      scrollRoot.scrollTop = Math.max(0, contentY - inset);
    } else {
      scrollRoot.scrollTop += delta;
    }
  }
};

const computeStickyInset = (scrollRoot: HTMLElement, baseInset: number): number => {
  let total = baseInset;

  for (const el of Array.from(scrollRoot.querySelectorAll("[data-tree-sticky-header]"))) {
    if (el instanceof HTMLElement) {
      total += el.offsetHeight;
    }
  }

  return total;
};

export const scrollFocusIntoView = (
  target: HTMLElement,
  options?: { containerAttribute?: string; kind?: TreeNavNodeKind; inset?: number },
): void => {
  const containerAttribute = options?.containerAttribute ?? "data-tree-scroll-container";
  const scrollRoot = findFocusScrollRoot(target, containerAttribute);

  if (scrollRoot) {
    const inset = computeStickyInset(scrollRoot, options?.inset ?? 4);

    scrollTreeFocusIntoView(target, scrollRoot, options?.kind, inset);
    return;
  }

  target.scrollIntoView({ block: "center", inline: "nearest" });
};

/** Scroll the tree list pane to the very top (Variables, filters, env header). */
export const scrollTreePaneToTop = (anchor?: HTMLElement | null): void => {
  const containerAttribute = "data-tree-scroll-container";

  if (anchor) {
    const scrollRoot = findFocusScrollRoot(anchor, containerAttribute);

    if (scrollRoot) {
      scrollRoot.scrollTop = 0;
      return;
    }
  }

  for (const element of Array.from(document.querySelectorAll(`[${containerAttribute}]`))) {
    if (element instanceof HTMLElement && isScrollableElement(element)) {
      element.scrollTop = 0;
      return;
    }
  }
};
