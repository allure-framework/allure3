import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { getAllure2Hint, renderAllure2CommandMap } from "../../src/utils/allure2Hints.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("cli-commands");
  await story("allure2-hints");
  await label("coverage", "cli-commands");
});

describe("getAllure2Hint", () => {
  it("suggests an alternative for removed Allure 2 options", () => {
    const hint = getAllure2Hint(["open", "--clean"], 'Unsupported option name ("--clean")');

    expect(hint).toContain("allure generate");
    expect(hint).not.toContain("rm -rf");
  });

  it("points to allurerc for --single-file and --lang", () => {
    expect(getAllure2Hint(["generate"], 'Unsupported option name ("--single-file")')).toContain("singleFile");
    expect(getAllure2Hint(["generate"], 'Unsupported option name ("--lang")')).toContain("reportLanguage");
  });

  it("does not claim that --verbose and --quiet are missing, Allure 3 supports them", () => {
    for (const option of ["--verbose", "--quiet", "-q"]) {
      expect(getAllure2Hint(["generate"], `Unsupported option name ("${option}")`)).toBeUndefined();
    }

    expect(renderAllure2CommandMap()).toContain("--verbose, --quiet (-v, -q)");
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
    expect(output).toContain("allure generate <results> --clean");
    expect(output).not.toContain("rm -rf");
  });
});
