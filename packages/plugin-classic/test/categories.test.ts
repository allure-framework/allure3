import { describe, expect, it } from "vitest";
import { matchCategories } from "../src/categories.js";

describe("categories", () => {
  it("should match by status", () => {
    const matched = matchCategories(
      [
        { name: "failed category", matchedStatuses: ["failed"] },
        { name: "broken category", matchedStatuses: ["broken"] },
        { name: "skipped category", matchedStatuses: ["skipped"] },
        { name: "multi category", matchedStatuses: ["failed", "skipped", "passed"] },
      ],
      {
        status: "failed",
        flaky: false,
      },
    );
    expect(matched).to.have.lengthOf(2, "should match provided category");
    expect(matched[0]).to.have.property("name", "failed category");
    expect(matched[1]).to.have.property("name", "multi category");
  });
  it("should match by message", () => {
    const matched = matchCategories(
      [
        { name: "some message category", messageRegex: ".*some message.*" },
        { name: "broken category", messageRegex: ".hey" },
        { name: "invalid message regex category", messageRegex: "$." },
        { name: "all matched category", messageRegex: ".*" },
      ],
      {
        status: "failed",
        statusMessage: "hello here the result with some message and more",
        flaky: false,
      },
    );
    expect(matched).to.have.lengthOf(2, "should match provided category");
    expect(matched[0]).to.have.property("name", "some message category");
    expect(matched[1]).to.have.property("name", "all matched category");
  });
  it("should match by message multi-line", () => {
    const matched = matchCategories(
      [
        { name: "some message category", messageRegex: ".*some message.*" },
        { name: "broken category", messageRegex: ".hey" },
        { name: "invalid message regex category", messageRegex: "$." },
        { name: "all matched category", messageRegex: ".*" },
      ],
      {
        status: "failed",
        statusMessage: "hello\n   here the result\nwith some message and\nmore\n",
        flaky: false,
      },
    );
    expect(matched).to.have.lengthOf(2, "should match provided category");
    expect(matched[0]).to.have.property("name", "some message category");
    expect(matched[1]).to.have.property("name", "all matched category");
  });
  it("should match by trace", () => {
    const matched = matchCategories(
      [
        { name: "some message category", traceRegex: ".*some message.*" },
        { name: "broken category", traceRegex: ".hey" },
        { name: "invalid message regex category", traceRegex: "$." },
        { name: "all matched category", traceRegex: ".*" },
      ],
      {
        status: "failed",
        statusTrace: "hello here the result with some message and more",
        flaky: false,
      },
    );
    expect(matched).to.have.lengthOf(2, "should match provided category");
    expect(matched[0]).to.have.property("name", "some message category");
    expect(matched[1]).to.have.property("name", "all matched category");
  });
  it("should match by trace multi-line", () => {
    const matched = matchCategories(
      [
        { name: "some message category", traceRegex: ".*some message.*" },
        { name: "broken category", traceRegex: ".hey" },
        { name: "invalid message regex category", traceRegex: "$." },
        { name: "all matched category", traceRegex: ".*" },
      ],
      {
        status: "failed",
        statusTrace: "hello\n   here the result\nwith some message and\nmore\n",
        flaky: false,
      },
    );
    expect(matched).to.have.lengthOf(2, "should match provided category");
    expect(matched[0]).to.have.property("name", "some message category");
    expect(matched[1]).to.have.property("name", "all matched category");
  });
});
