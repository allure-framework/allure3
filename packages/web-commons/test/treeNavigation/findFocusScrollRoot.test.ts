import { describe, expect, it } from "vitest";

import { findFocusScrollRoot } from "../../src/treeNavigation/scrollTreeFocus.js";

describe("findFocusScrollRoot", () => {
  it("skips a marked wrapper that does not scroll and returns the outer scrollport", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    const target = document.createElement("div");

    outer.setAttribute("data-tree-scroll-container", "true");
    Object.defineProperty(outer, "scrollHeight", { value: 800, configurable: true });
    Object.defineProperty(outer, "clientHeight", { value: 400, configurable: true });

    inner.setAttribute("data-tree-scroll-container", "true");
    Object.defineProperty(inner, "scrollHeight", { value: 100, configurable: true });
    Object.defineProperty(inner, "clientHeight", { value: 100, configurable: true });

    outer.append(inner);
    inner.append(target);
    document.body.append(outer);

    const getComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (element: Element) => {
      const style = getComputedStyle(element);

      if (element === outer) {
        return { ...style, overflowY: "auto" } as CSSStyleDeclaration;
      }

      if (element === inner) {
        return { ...style, overflowY: "visible" } as CSSStyleDeclaration;
      }

      return style;
    };

    try {
      expect(findFocusScrollRoot(target, "data-tree-scroll-container")).toBe(outer);
    } finally {
      window.getComputedStyle = getComputedStyle;
      outer.remove();
    }
  });
});
