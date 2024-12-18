import { describe, expect, it } from "vitest";
import { parseProperties } from "../src/properties.js";

const data = `allure.test.run.id=2a54c4d7-7d79-4615-b80d-ffc1107016a1
allure.test.run.name=Allure sample test pack
allure.test.run.url=https://allurereport.org
my.properties.browser=Firefox
my.first.url=https://qameta.io/
my.second.url=https://allurereport.org/
allure.home.page=https://allurereport.org
qatools.home.page=https://qameta.io/
more.projects=https://github.com/allure-framework
help.us=https://github.com/allure-framework/discussions
x.more.properties1=some-value1
x.more.properties2=some-value2
x.more.properties3=some-value3
x.more.properties4=some-value4
x.more.properties5=some-value5
x.more.properties6=some-value6`;

describe("envInfo", () => {
  it("should parse", async () => {
    const parsed = parseProperties(data);

    expect(parsed).toEqual(
      expect.objectContaining({
        "allure.home.page": "https://allurereport.org",
        "allure.test.run.id": "2a54c4d7-7d79-4615-b80d-ffc1107016a1",
        "allure.test.run.name": "Allure sample test pack",
        "allure.test.run.url": "https://allurereport.org",
        "help.us": "https://github.com/allure-framework/discussions",
        "more.projects": "https://github.com/allure-framework",
        "my.first.url": "https://qameta.io/",
        "my.properties.browser": "Firefox",
        "my.second.url": "https://allurereport.org/",
        "qatools.home.page": "https://qameta.io/",
        "x.more.properties1": "some-value1",
        "x.more.properties2": "some-value2",
        "x.more.properties3": "some-value3",
        "x.more.properties4": "some-value4",
        "x.more.properties5": "some-value5",
        "x.more.properties6": "some-value6",
      }),
    );
  });
});
