import { UsageError } from "clipanion";
import { describe, expect, it } from "vite-plus/test";

import {
  buildGhWorkflowYaml,
  configuredEnvironmentIds,
  normalizeEnvironmentIds,
  shellQuote,
} from "../src/utils/ghWorkflow.js";

const matrixExpression = "${{ matrix.environment }}";

describe("shellQuote", () => {
  it("leaves safe tokens untouched", () => {
    expect(shellQuote("npm")).toBe("npm");
    expect(shellQuote("--reporter=dot")).toBe("--reporter=dot");
    expect(shellQuote("./allurerc.mjs")).toBe("./allurerc.mjs");
  });

  it.each([
    ["a b", "'a b'"],
    ["a$b", "'a$b'"],
    ["a`b`", "'a`b`'"],
    ["a;rm -rf /", "'a;rm -rf /'"],
    ["it's", "'it'\\''s'"],
    ["", "''"],
    ["=foo", "'=foo'"],
  ])("quotes %j", (input, expected) => {
    expect(shellQuote(input)).toBe(expected);
  });
});

describe("normalizeEnvironmentIds", () => {
  it("keeps the given order, trims and drops duplicates", () => {
    expect(normalizeEnvironmentIds(["foo", " bar ", "foo", "baz"])).toEqual(["foo", "bar", "baz"]);
  });

  it.each(["", "   ", "a/b", "a\nb"])("rejects %j", (value) => {
    expect(() => normalizeEnvironmentIds([value])).toThrow(UsageError);
  });

  it("does not require the ids to be declared in a config", () => {
    expect(normalizeEnvironmentIds(["anything-goes"])).toEqual(["anything-goes"]);
  });
});

describe("configuredEnvironmentIds", () => {
  const matcher = () => true;

  it("returns the declared ids", () => {
    expect(configuredEnvironmentIds({ a: { matcher }, b: { name: "B", matcher } })).toEqual(["a", "b"]);
  });

  it("lists integer-like ids first, as JavaScript orders object keys", () => {
    expect(
      configuredEnvironmentIds({ "b": { matcher }, "10": { matcher }, "a": { matcher }, "2": { matcher } }),
    ).toEqual(["2", "10", "b", "a"]);
  });

  it("fails when there are no environments and says what to do", () => {
    expect(() => configuredEnvironmentIds(undefined)).toThrow(/no environments/i);
    expect(() => configuredEnvironmentIds({})).toThrow(/no allurerc file was found/);
    expect(() => configuredEnvironmentIds({})).toThrow(/--env/);
  });
});

describe("buildGhWorkflowYaml", () => {
  const build = (options: Partial<Parameters<typeof buildGhWorkflowYaml>[0]> = {}) =>
    buildGhWorkflowYaml({ environmentIds: ["foo", "bar", "baz"], ...options });

  it("declares the matrix with every environment id", () => {
    expect(build()).toContain('environment: ["foo", "bar", "baz"]');
  });

  it("quotes ids that YAML would otherwise turn into booleans or numbers", () => {
    expect(build({ environmentIds: ["on", "123", "true", "null"] })).toContain(
      'environment: ["on", "123", "true", "null"]',
    );
  });

  it("runs the tests through allure run and defaults to npm test", () => {
    expect(build()).toContain(
      `npx allure run --environment=${matrixExpression} --dump=allure-results-${matrixExpression} -- npm test`,
    );
  });

  it("quotes a custom test command for the shell", () => {
    expect(build({ testCommand: ["yarn", "test", "--grep", "a b", "it's"] })).toContain(
      "-- yarn test --grep 'a b' 'it'\\''s'",
    );
  });

  it("passes --config to both allure commands", () => {
    const yaml = build({ config: "./config/allurerc.mjs" });

    expect(yaml).toContain("npx allure run --config=./config/allurerc.mjs --environment=");
    expect(yaml).toContain("npx allure generate --config=./config/allurerc.mjs --dump=");
  });

  it("keeps the dump, artifact and download names consistent for every environment", () => {
    const yaml = build();
    const dumpName = /--dump=(allure-results-\$\{\{ matrix\.environment \}\}) --/.exec(yaml)?.[1];
    const artifactName = /name: (allure-results-\$\{\{ matrix\.environment \}\})\n/.exec(yaml)?.[1];
    const artifactPath = /path: \.\/(allure-results-\$\{\{ matrix\.environment \}\}\.zip)\n/.exec(yaml)?.[1];
    const downloadPattern = /pattern: (\S+)\n/.exec(yaml)?.[1];
    const generateGlob = /--dump="([^"]+)"/.exec(yaml)?.[1];
    const globToRegExp = (glob: string) => new RegExp(`^${glob.replaceAll(".", "\\.").replaceAll("*", "[^/]*")}$`);

    expect(dumpName).toBeDefined();
    expect(artifactName).toBe(dumpName);
    expect(artifactPath).toBe(`${dumpName}.zip`);

    for (const id of ["foo", "bar", "baz"]) {
      const artifact = artifactName!.replace(matrixExpression, id);
      const file = artifactPath!.replace(matrixExpression, id);

      // download-artifact puts every artifact into a directory named after it
      expect(globToRegExp(downloadPattern!).test(artifact)).toBe(true);
      expect(globToRegExp(generateGlob!).test(`${artifact}/${file}`)).toBe(true);
    }
  });

  it("is indented as the children of the jobs mapping", () => {
    const lines = build().trimEnd().split("\n");

    expect(lines[0]).toMatch(/^# /);
    expect(lines.filter((line) => line !== "" && !line.startsWith("  ") && !line.startsWith("#"))).toEqual([]);
    expect(build().endsWith("\n")).toBe(true);
  });

  it("rejects an empty environment list", () => {
    expect(() => build({ environmentIds: [] })).toThrow(UsageError);
  });

  it.each(["a\nb", "a\u0000b", "a‮b", "a\u{e0041}b"])("rejects %j in the test command or config", (value) => {
    expect(() => build({ testCommand: ["npm", value] })).toThrow(UsageError);
    expect(() => build({ config: value })).toThrow(UsageError);
  });
});
