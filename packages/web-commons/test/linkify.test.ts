import { describe, expect, it } from "vitest";

import { splitTextWithUrls, textContainsUrl } from "../src/linkify.js";

describe("linkify", () => {
  it("returns plain text when no url is present", () => {
    expect(splitTextWithUrls("Web site without link")).toEqual([{ type: "text", value: "Web site without link" }]);
    expect(textContainsUrl("Web site without link")).toBe(false);
  });

  it("splits http url at the end of the title", () => {
    expect(splitTextWithUrls("Web site http://example.com/")).toEqual([
      { type: "text", value: "Web site " },
      { type: "url", value: "http://example.com/" },
    ]);
  });

  it("includes trailing dot in the url when it is not a terminator", () => {
    expect(splitTextWithUrls("see http://example.com.")).toEqual([
      { type: "text", value: "see " },
      { type: "url", value: "http://example.com." },
    ]);
  });

  it("linkifies www urls", () => {
    expect(splitTextWithUrls("open www.example.com now")).toEqual([
      { type: "text", value: "open " },
      { type: "url", value: "www.example.com" },
      { type: "text", value: "now" },
    ]);
  });

  it("linkifies multiple urls in one title", () => {
    expect(splitTextWithUrls("a http://one.test b https://two.test c")).toEqual([
      { type: "text", value: "a " },
      { type: "url", value: "http://one.test" },
      { type: "text", value: "b " },
      { type: "url", value: "https://two.test" },
      { type: "text", value: "c" },
    ]);
  });
});
