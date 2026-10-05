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

  it("renders parameter values next to the test name", () => {
    render(
      <TreeItem
        id="test-result-1"
        name="parameterized test"
        parameters={["chromium", "admin"]}
        groupOrder={1}
        navigateTo={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tree-leaf-title").textContent).toBe("parameterized test");
    expect(screen.getByTestId("tree-leaf-parameters").textContent).toBe("chromium,admin");
  });
});
