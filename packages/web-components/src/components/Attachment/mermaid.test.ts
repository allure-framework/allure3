import { beforeEach, describe, expect, it, vi } from "vitest";

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  mermaidAPI: { globalReset: vi.fn() },
  render: vi.fn().mockResolvedValue({ svg: '<svg aria-label="diagram"></svg>' }),
}));

vi.mock("mermaid", () => ({ default: mermaid }));

import { preserveMermaidNaturalWidth, renderMermaid } from "./mermaid";

beforeEach(() => {
  mermaid.initialize.mockClear();
  mermaid.mermaidAPI.globalReset.mockClear();
  mermaid.render.mockClear();
});

describe("renderMermaid", () => {
  it("renders diagrams with a locked-down Mermaid configuration", async () => {
    await expect(renderMermaid("diagram-1", "flowchart LR\nA --> B")).resolves.toBe('<svg aria-label="diagram"></svg>');

    expect(mermaid.initialize).toHaveBeenCalledWith({
      securityLevel: "strict",
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: "default",
    });
    expect(mermaid.mermaidAPI.globalReset).toHaveBeenCalledOnce();
    expect(mermaid.render).toHaveBeenCalledWith("diagram-1", "flowchart LR\nA --> B");
  });

  it("applies the requested theme before rendering", async () => {
    await renderMermaid("diagram-dark", "flowchart LR\nA --> B", "dark");

    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));
  });
});

describe("preserveMermaidNaturalWidth", () => {
  it("uses the viewBox width so large diagrams can scroll instead of shrinking", () => {
    expect(preserveMermaidNaturalWidth('<svg width="100%" viewBox="0 0 1804.5 70"></svg>')).toBe(
      '<svg width="1804.5" viewBox="0 0 1804.5 70"></svg>',
    );
  });

  it("leaves SVG without a usable viewBox unchanged", () => {
    expect(preserveMermaidNaturalWidth('<svg width="100%"></svg>')).toBe('<svg width="100%"></svg>');
  });
});
