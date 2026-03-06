import { describe, expect, it } from "vitest";

import { createReportDataScript } from "../src/static.js";

describe("createReportDataScript", () => {
  it("should escape windows-like report data paths safely", () => {
    const script = createReportDataScript([
      {
        name: "widgets\\default\\tree.json",
        value: "dmFsdWU=",
      },
    ]);

    expect(script).toContain('d("widgets\\\\default\\\\tree.json","dmFsdWU=")');
  });

  it("should generate JSON-stringified data declarations", () => {
    const script = createReportDataScript([
      {
        name: "widgets/default/nav.json",
        value: "eyJmb28iOiJiYXIifQ==",
      },
    ]);

    expect(script).toContain('d("widgets/default/nav.json","eyJmb28iOiJiYXIifQ==")');
    expect(script).not.toContain("d('widgets/default/nav.json'");
  });
});
