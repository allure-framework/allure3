import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TreeItem } from "./TreeItem";

afterEach(() => {
  cleanup();
});

describe("TreeItem", () => {
  it("renders as a button and navigates on activation", () => {
    const navigateTo = vi.fn();

    render(<TreeItem id="test-result-1" name="failed test" groupOrder={1} navigateTo={navigateTo} />);

    const item = screen.getByRole("button", { name: /failed test/i });

    fireEvent.click(item);

    expect(navigateTo).toHaveBeenCalledWith("test-result-1");
  });
});
