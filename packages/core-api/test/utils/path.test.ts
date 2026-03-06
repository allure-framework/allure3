import { describe, expect, it } from "vitest";

import { joinPosixPath, toPosixPath } from "../../src/utils/path.js";

describe("path utils", () => {
  it("should normalize windows separators to posix", () => {
    expect(toPosixPath("a\\b\\c")).toBe("a/b/c");
  });

  it("should join and normalize report path segments", () => {
    expect(joinPosixPath("data", "attachments", "foo\\bar.txt")).toBe("data/attachments/foo/bar.txt");
  });

  it("should keep valid posix path segments stable", () => {
    expect(joinPosixPath("widgets", "default/tree.json")).toBe("widgets/default/tree.json");
  });

  it("should avoid duplicated separators in mixed inputs", () => {
    expect(joinPosixPath("widgets\\", "/default", "tree.json")).toBe("widgets/default/tree.json");
  });
});
