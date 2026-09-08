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
});
