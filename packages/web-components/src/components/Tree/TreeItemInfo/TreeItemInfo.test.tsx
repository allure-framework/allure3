import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";

import { TreeItemInfo } from "./index";

describe("TreeItemInfo", () => {
  it("renders known issue marker", () => {
    render(<TreeItemInfo known tooltips={{ known: "Known issue test result" }} />);

    expect(screen.getByTestId("tree-leaf-known")).not.toBeNull();
    expect(screen.getByTestId("tree-leaf-duration")).not.toBeNull();
  });
});
