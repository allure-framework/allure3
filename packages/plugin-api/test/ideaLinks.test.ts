import { describe, expect, it } from "vite-plus/test";

import { createIdeaLink } from "../src/utils/ideaLinks.js";

const labels = [{ name: "testClass", value: "org.example.FooTest" }];

describe("createIdeaLink", () => {
  it("should build a link from the testClass label with default options", () => {
    expect(createIdeaLink(labels, true)).toEqual([
      {
        name: "Open in IDEA",
        type: "idea",
        url: "http://localhost:63342/api/file?file=org%2Fexample%2FFooTest.java",
      },
    ]);
  });

  it("should apply port, file extension and source root", () => {
    const [link] = createIdeaLink(labels, { port: 1234, fileExtension: ".kt", sourceRoot: "/src/test/kotlin/" });

    expect(link.url).toBe("http://localhost:1234/api/file?file=src%2Ftest%2Fkotlin%2Forg%2Fexample%2FFooTest.kt");
  });

  it("should treat a source root of only slashes as no source root", () => {
    const [link] = createIdeaLink(labels, { sourceRoot: "/".repeat(100_000) });

    expect(link.url).toBe("http://localhost:63342/api/file?file=org%2Fexample%2FFooTest.java");
  });

  it("should point nested classes to the outer class file", () => {
    const [link] = createIdeaLink([{ name: "testClass", value: "org.example.FooTest$Inner" }], {});

    expect(link.url).toBe("http://localhost:63342/api/file?file=org%2Fexample%2FFooTest.java");
  });

  it.each(["Login suite", "tests/login.spec.ts", "", "org..FooTest", "1abc.Foo", "$Foo"])(
    "should skip non-class testClass %j",
    (value) => {
      expect(createIdeaLink([{ name: "testClass", value }], true)).toEqual([]);
    },
  );

  it("should skip results without the testClass label", () => {
    expect(createIdeaLink([], true)).toEqual([]);
  });
});
