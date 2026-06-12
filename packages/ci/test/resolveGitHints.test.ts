import { CiType, type CiDescriptor } from "@allurereport/core-api";
import { describe, expect, it } from "vitest";

import { resolveGitHints } from "../src/resolveGitHints.js";

describe("resolveGitHints", () => {
  it("dispatches by CiType", () => {
    const jenkins = { type: CiType.Jenkins } as CiDescriptor;

    expect(resolveGitHints(jenkins)).toEqual({});
  });
});
