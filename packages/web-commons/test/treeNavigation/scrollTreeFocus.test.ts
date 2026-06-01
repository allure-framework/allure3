import { describe, expect, it } from "vitest";

import { computeTreeFocusScrollDelta } from "../../src/treeNavigation/scrollTreeFocus.js";

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
