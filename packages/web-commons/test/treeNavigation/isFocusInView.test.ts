import { describe, expect, it } from "vitest";

import { isFocusInView } from "../../src/treeNavigation/scrollTreeFocus.js";

const buildScrollport = (targetRect: { top: number; bottom: number }) => {
  const scrollport = document.createElement("div");
  const target = document.createElement("div");

  scrollport.setAttribute("data-tree-scroll-container", "true");
  Object.defineProperty(scrollport, "scrollHeight", { value: 800, configurable: true });
  Object.defineProperty(scrollport, "clientHeight", { value: 400, configurable: true });
  scrollport.getBoundingClientRect = () => ({ top: 0, bottom: 400 }) as DOMRect;
  target.getBoundingClientRect = () => targetRect as DOMRect;

  scrollport.append(target);
  document.body.append(scrollport);

  const original = window.getComputedStyle;
  window.getComputedStyle = (element: Element) =>
    element === scrollport ? ({ ...original(element), overflowY: "auto" } as CSSStyleDeclaration) : original(element);

  return {
    target,
    restore: () => {
      window.getComputedStyle = original;
      scrollport.remove();
    },
  };
};

describe("isFocusInView", () => {
  it("reports a row inside the scrollport as visible", () => {
    const { target, restore } = buildScrollport({ top: 100, bottom: 130 });

    try {
      expect(isFocusInView(target)).toBe(true);
    } finally {
      restore();
    }
  });

  it("reports a row scrolled past the bottom edge as hidden", () => {
    const { target, restore } = buildScrollport({ top: 500, bottom: 530 });

    try {
      expect(isFocusInView(target)).toBe(false);
    } finally {
      restore();
    }
  });

  it("reports a row scrolled above the top edge as hidden", () => {
    const { target, restore } = buildScrollport({ top: -40, bottom: -10 });

    try {
      expect(isFocusInView(target)).toBe(false);
    } finally {
      restore();
    }
  });
});
