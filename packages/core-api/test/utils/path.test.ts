import { describe, expect, it } from "vitest";
import { getPosixPath } from "../../src/utils/path.js";

describe("getPosixPath", () => {
  it("should normalize windows separators to posix", () => {
    expect(getPosixPath("widgets\\default\\tree.json")).toBe("widgets/default/tree.json");
  });

  it("should keep posix paths unchanged", () => {
    expect(getPosixPath("widgets/default/tree.json")).toBe("widgets/default/tree.json");
  });
});
