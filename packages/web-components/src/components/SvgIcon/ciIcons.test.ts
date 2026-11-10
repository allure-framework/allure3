import { CiType } from "@allurereport/core-api";
import { describe, expect, it } from "vite-plus/test";

import { getCiIconId } from "./ciIcons";

describe("getCiIconId", () => {
  it("returns the icon of a well-known CI provider", () => {
    expect(getCiIconId(CiType.Amazon)).toBe("amazon");
    expect(getCiIconId(CiType.Azure)).toBe("azure");
    expect(getCiIconId(CiType.Bitbucket)).toBe("bitbucket");
    expect(getCiIconId(CiType.Circle)).toBe("circleci");
    expect(getCiIconId(CiType.Drone)).toBe("drone");
    expect(getCiIconId(CiType.Github)).toBe("github");
    expect(getCiIconId(CiType.Gitlab)).toBe("gitlab");
    expect(getCiIconId(CiType.Jenkins)).toBe("jenkins");
  });

  it("returns no icon for the local or unknown CI", () => {
    expect(getCiIconId(CiType.Local)).toBeUndefined();
    expect(getCiIconId(undefined)).toBeUndefined();
  });
});
