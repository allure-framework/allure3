import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/Button";

describe("Button", () => {
  it("renders the button with text", async () => {
    const handleClick = vi.fn();
    render(<Button text="Click me" onClick={handleClick} />);
    const button = screen.getByRole("button", { name: /click me/i });
    await fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
