import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "@/components/Button";

beforeEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders the button with text", async () => {
    const handleClick = vi.fn();

    render(<Button text="Click me" onClick={handleClick} />);

    const button = screen.getByRole("button", { name: /click me/i });

    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders as a link when href is provided", () => {
    render(<Button text="Link Button" href="https://example.com" />);

    const link = screen.getByRole("link", { name: /link button/i });

    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://example.com");
  });

  it("handles disabled state correctly when rendered as a link", () => {
    render(<Button text="Disabled Link" href="https://example.com" isDisabled={true} />);

    const link = screen.getByRole("link", { name: /disabled link/i });

    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.style.pointerEvents).toBe("none");
  });

  it("handles click events when rendered as a link", () => {
    const handleClick = vi.fn();

    render(<Button text="Clickable Link" href="https://example.com" onClick={handleClick} />);

    const link = screen.getByRole("link", { name: /clickable link/i });

    fireEvent.click(link);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("IconButton", () => {
  it("renders the icon button", () => {
    const handleClick = vi.fn();

    render(<IconButton icon="test-icon" onClick={handleClick} />);

    const button = screen.getByRole("button");

    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders as an anchor when href is provided", () => {
    render(<IconButton icon="test-icon" href="https://example.com" />);

    const link = screen.getByRole("link");

    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://example.com");
  });

  it("handles disabled state correctly when rendered as an anchor", () => {
    render(<IconButton icon="test-icon" href="https://example.com" isDisabled={true} />);

    const link = screen.getByRole("link");

    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.style.pointerEvents).toBe("none");
  });
});
