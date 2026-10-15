import type { Mermaid } from "mermaid";

let mermaidPromise: Promise<Mermaid> | undefined;
let renderQueue = Promise.resolve();

const loadMermaid = async (): Promise<Mermaid> => {
  const { default: mermaid } = await import("mermaid");
  return mermaid;
};

export const preserveMermaidNaturalWidth = (svg: string): string => {
  const viewBox = svg.match(/\bviewBox="([^"]+)"/)?.[1];
  const width = viewBox?.trim().split(/\s+/)[2];

  if (!width || !Number.isFinite(Number(width)) || Number(width) <= 0) {
    return svg;
  }

  return svg.replace(/(<svg\b[^>]*\s)width="100%"/, `$1width="${width}"`);
};

export const renderMermaid = (
  id: string,
  definition: string,
  theme: "default" | "dark" = "default",
): Promise<string> => {
  const render = async () => {
    const mermaid = await (mermaidPromise ??= loadMermaid());

    mermaid.mermaidAPI.globalReset();
    mermaid.initialize({
      securityLevel: "strict",
      startOnLoad: false,
      suppressErrorRendering: true,
      theme,
    });

    const { svg } = await mermaid.render(id, definition);

    return preserveMermaidNaturalWidth(svg);
  };
  const result = renderQueue.then(render, render);

  renderQueue = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
};
