import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { getAllure2Hint, renderAllure2CommandMap } from "../../src/utils/allure2Hints.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("allure2-hints");
  await label("coverage", "cli-commands");
});

describe("getAllure2Hint", () => {
  it("suggests an alternative for removed Allure 2 options", () => {
    const hint = getAllure2Hint(["generate", "--clean"], 'Unsupported option name ("--clean")');

    expect(hint).toContain("allure run");
  });

  it("points to allurerc for --single-file and --lang", () => {
    expect(getAllure2Hint(["generate"], 'Unsupported option name ("--single-file")')).toContain("singleFile");
    expect(getAllure2Hint(["generate"], 'Unsupported option name ("--lang")')).toContain("reportLanguage");
  });

  it("suggests a replacement for removed Allure 2 commands", () => {
    expect(getAllure2Hint(["plugin"], "Command not found; did you mean one of:")).toContain("allurerc");
  });

  it("returns nothing for unknown options and commands", () => {
    expect(getAllure2Hint(["generate"], 'Unsupported option name ("--whatever")')).toBeUndefined();
    expect(getAllure2Hint(["whatever"], "Command not found")).toBeUndefined();
    expect(getAllure2Hint(["generate"], "Something else failed")).toBeUndefined();
  });
});

describe("renderAllure2CommandMap", () => {
  it("lists Allure 3 equivalents of the Allure 2 commands", () => {
    const output = renderAllure2CommandMap();

    expect(output).toContain("allure serve <results>");
    expect(output).toContain("allure open <results>");
    expect(output).toContain("allure run -- <test command>");
  });
});
