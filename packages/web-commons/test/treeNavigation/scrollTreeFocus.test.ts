import { describe, expect, it } from "vitest";

import { computeTreeFocusScrollDelta, scrollFocusIntoView } from "../../src/treeNavigation/scrollTreeFocus.js";

describe("computeTreeFocusScrollDelta", () => {
  const root = { top: 100, bottom: 400 };

  it("pins group headers to the top when out of view", () => {
    expect(computeTreeFocusScrollDelta({ top: 50, bottom: 80 }, root, "group")).toBe(-54);
  });

  it("pins env headers to the top when out of view", () => {
    expect(computeTreeFocusScrollDelta({ top: 420, bottom: 452 }, root, "env")).toBe(316);
  });

  it("does not scroll groups already fully visible", () => {
    expect(computeTreeFocusScrollDelta({ top: 250, bottom: 280 }, root, "group")).toBe(0);
  });

  it("centers leaves when above the viewport", () => {
    expect(computeTreeFocusScrollDelta({ top: 50, bottom: 80 }, root, "leaf")).toBe(-185);
  });

  it("centers leaves when below the viewport", () => {
    expect(computeTreeFocusScrollDelta({ top: 420, bottom: 450 }, root, "leaf")).toBe(185);
  });

  it("does not scroll leaves already fully visible", () => {
    expect(computeTreeFocusScrollDelta({ top: 150, bottom: 180 }, root, "leaf")).toBe(0);
  });
});

describe("scrollFocusIntoView", () => {
  const rect = (top: number, bottom: number) =>
    ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

  const buildScrollContainer = () => {
    const container = document.createElement("div");
    const target = document.createElement("div");

    container.setAttribute("data-tree-scroll-container", "true");
    Object.defineProperty(container, "scrollHeight", { value: 800, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 400, configurable: true });
    container.append(target);
    document.body.append(container);

    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (el: Element) => {
      if (el === container) {
        return { ...originalGetComputedStyle(el), overflowY: "auto" } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(el);
    };

    const cleanup = () => {
      window.getComputedStyle = originalGetComputedStyle;
      container.remove();
    };

    return { container, target, cleanup };
  };

  it("pins group nodes below sticky inset when scrolled past them", () => {
    const { container, target, cleanup } = buildScrollContainer();
    container.scrollTop = 300;
    container.getBoundingClientRect = () => rect(0, 400);
    target.getBoundingClientRect = () => rect(-100, -70); // above viewport, scrolled past

    try {
      scrollFocusIntoView(target, { kind: "group" });
      // contentY = -100 - 0 + 300 = 200; scrollTop = max(0, 200 - 4) = 196
      expect(container.scrollTop).toBe(196);
    } finally {
      cleanup();
    }
  });

  it("pins env nodes below sticky inset when below viewport", () => {
    const { container, target, cleanup } = buildScrollContainer();
    container.getBoundingClientRect = () => rect(0, 400);
    target.getBoundingClientRect = () => rect(450, 480); // below viewport

    try {
      scrollFocusIntoView(target, { kind: "env" });
      // contentY = 450 - 0 + 0 = 450; scrollTop = max(0, 450 - 4) = 446
      expect(container.scrollTop).toBe(446);
    } finally {
      cleanup();
    }
  });

  it("clamps scrollTop to 0 when group content position is less than sticky inset", () => {
    const { container, target, cleanup } = buildScrollContainer();
    const stickyHeader = document.createElement("div");
    stickyHeader.setAttribute("data-tree-sticky-header", "");
    Object.defineProperty(stickyHeader, "offsetHeight", { value: 120, configurable: true });
    container.prepend(stickyHeader);

    // scrollTop=0, target is visible at Y=50 but within the sticky-inset zone (0–124)
    container.getBoundingClientRect = () => rect(0, 400);
    target.getBoundingClientRect = () => rect(50, 80);

    try {
      scrollFocusIntoView(target, { kind: "group" });
      // inset = 4 + 120 = 124; target is out of scrollport (50 < 124)
      // contentY = 50 - 0 + 0 = 50; scrollTop = max(0, 50 - 124) = 0 (clamped — can't go further up)
      expect(container.scrollTop).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("centers leaf nodes in the scroll container when out of view", () => {
    const { container, target, cleanup } = buildScrollContainer();
    container.getBoundingClientRect = () => rect(100, 500);
    target.getBoundingClientRect = () => rect(520, 550);

    try {
      scrollFocusIntoView(target, { kind: "leaf" });
      // nodeCenter = 535, rootCenter = 300, delta = 235
      expect(container.scrollTop).toBe(235);
    } finally {
      cleanup();
    }
  });

  it("does not scroll when node is already visible", () => {
    const { container, target, cleanup } = buildScrollContainer();
    container.scrollTop = 100;
    container.getBoundingClientRect = () => rect(100, 500);
    target.getBoundingClientRect = () => rect(200, 230);

    try {
      scrollFocusIntoView(target, { kind: "leaf" });
      expect(container.scrollTop).toBe(100);
    } finally {
      cleanup();
    }
  });

  it("accounts for sticky header height when pinning group to top", () => {
    const { container, target, cleanup } = buildScrollContainer();
    const stickyHeader = document.createElement("div");
    stickyHeader.setAttribute("data-tree-sticky-header", "");
    Object.defineProperty(stickyHeader, "offsetHeight", { value: 120, configurable: true });
    container.prepend(stickyHeader);

    container.scrollTop = 300;
    container.getBoundingClientRect = () => rect(0, 400);
    target.getBoundingClientRect = () => rect(-100, -70);

    try {
      scrollFocusIntoView(target, { kind: "group" });
      // inset = 4 + 120 = 124; contentY = -100 - 0 + 300 = 200; scrollTop = max(0, 200 - 124) = 76
      expect(container.scrollTop).toBe(76);
    } finally {
      cleanup();
    }
  });

  it("falls back to native scrollIntoView when no scroll container is found", () => {
    const target = document.createElement("div");
    let called = false;
    target.scrollIntoView = () => {
      called = true;
    };
    document.body.append(target);

    try {
      scrollFocusIntoView(target, { kind: "leaf" });
      expect(called).toBe(true);
    } finally {
      target.remove();
    }
  });
});
