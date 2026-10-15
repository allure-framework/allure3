import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

const renderMermaid = vi.hoisted(() => vi.fn());

vi.mock("./mermaid", () => ({ renderMermaid }));

import { MermaidPreview } from "./MermaidPreview";

afterEach(() => {
  cleanup();
  renderMermaid.mockReset();
});

describe("MermaidPreview", () => {
  it("shows a loader while Mermaid is rendering", () => {
    renderMermaid.mockReturnValue(new Promise(() => {}));

    render(<MermaidPreview attachment={{ text: "flowchart LR\nClient --> Server" }} />);

    expect(screen.getByTestId("mermaid-attachment-loading")).toBeTruthy();
  });

  it("renders the generated SVG", async () => {
    renderMermaid.mockResolvedValue('<svg aria-label="Client flow"></svg>');

    render(<MermaidPreview attachment={{ text: "flowchart LR\nClient --> Server" }} />);

    await waitFor(() => expect(screen.getByLabelText("Client flow")).toBeTruthy());
    expect(renderMermaid).toHaveBeenCalledWith(
      expect.stringMatching(/^allure-mermaid-/),
      "flowchart LR\nClient --> Server",
      "default",
    );
  });

  it("shows a useful fallback for invalid diagrams", async () => {
    renderMermaid.mockRejectedValue(new Error("Parse error"));

    render(<MermaidPreview attachment={{ text: "not a diagram" }} />);

    await waitFor(() => expect(screen.getByText("Failed to render Mermaid diagram")).toBeTruthy());
  });
});
