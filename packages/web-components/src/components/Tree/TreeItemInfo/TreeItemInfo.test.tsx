import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { TreeItemInfo } from "./index";

afterEach(() => {
  cleanup();
});

describe("TreeItemInfo", () => {
  it("renders the resolution category marker", () => {
    render(<TreeItemInfo resolution="issue" />);

    expect(screen.queryByTestId("tree-leaf-resolution-issue")).not.toBeNull();
  });

  it("shows status change marker instead of retry count for changed retries", () => {
    const { rerender } = render(<TreeItemInfo retriesCount={2} retriesStatusChange />);

    expect(screen.queryByTestId("tree-leaf-retries")).toBeNull();
    expect(screen.queryByTestId("tree-leaf-retries-status-change")).not.toBeNull();

    rerender(<TreeItemInfo retriesCount={2} retriesStatusChange={false} />);

    expect(screen.queryByTestId("tree-leaf-retries")).not.toBeNull();
    expect(screen.queryByTestId("tree-leaf-retries-status-change")).toBeNull();
  });
});
