import { describe, expect, it } from "vitest";

import { attachmentType } from "../src/attachments.js";

describe("attachmentType", () => {
  it("maps text/markdown to markdown", () => {
    expect(attachmentType("text/markdown")).toBe("markdown");
  });

  it("keeps text/plain as text", () => {
    expect(attachmentType("text/plain")).toBe("text");
  });

  it("maps text/html to html", () => {
    expect(attachmentType("text/html")).toBe("html");
  });
});
