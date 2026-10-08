import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchBox } from "@/components/SearchBox";

beforeEach(async () => {
  await story("SearchBox");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const searchInput = () => screen.getByTestId("search-input") as HTMLInputElement;

describe("SearchBox", () => {
  it("syncs the input when the value prop is cleared", () => {
    const { rerender } = render(<SearchBox value="failed" onChange={vi.fn()} />);

    expect(searchInput().value).toBe("failed");

    rerender(<SearchBox value="" onChange={vi.fn()} />);

    expect(searchInput().value).toBe("");
  });

  it("does not emit a pending debounce after unmount", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { unmount } = render(<SearchBox value="" onChange={onChange} changeDebounce={300} />);

    fireEvent.input(searchInput(), { target: { value: "failed" } });
    unmount();
    vi.advanceTimersByTime(400);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not emit a pending debounce after the value prop is reset", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { rerender } = render(<SearchBox value="failed" onChange={onChange} changeDebounce={300} />);

    fireEvent.input(searchInput(), { target: { value: "broken" } });
    rerender(<SearchBox value="" onChange={onChange} changeDebounce={300} />);
    vi.advanceTimersByTime(400);

    expect(searchInput().value).toBe("");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the input immediately when the clear button is pressed", () => {
    const onChange = vi.fn();

    render(<SearchBox value="failed" onChange={onChange} changeDebounce={300} />);

    fireEvent.click(screen.getByTestId("clear-button"));

    expect(searchInput().value).toBe("");
    expect(onChange).toHaveBeenCalledWith("");
  });
});
