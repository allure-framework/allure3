import type { Config, PluginExpressionFields } from "@allurereport/plugin-api";
import { describe, expect, it } from "vite-plus/test";

import {
  findUnsupportedCoreExpressions,
  findUnsupportedExpressions,
  supportsCoreExpression,
  supportsPluginExpression,
} from "../../src/config/expressionWarnings.js";

const expression = "${{ env.VALUE }}";

describe("unsupported expression traversal", () => {
  it("reports string values with precise paths without mutating input", () => {
    const variables = Object.freeze({ "build.name": expression });
    const input = Object.freeze({
      output: expression,
      globalAttachments: Object.freeze([expression]),
      variables,
      literal: "text ${{ env.VALUE }}",
      escaped: "$${{ env.VALUE }}",
    });

    const paths = findUnsupportedExpressions(input, () => false);

    expect(paths).toEqual(["config.output", "config.globalAttachments[0]", 'config.variables["build.name"]']);
    expect(input.variables).toBe(variables);
    expect(input.output).toBe(expression);
  });

  it("terminates cycles while inspecting shared objects under each path", () => {
    const shared = Object.assign(Object.create(null), { value: expression });
    const input: Record<string, unknown> = { first: shared, second: shared };
    input.self = input;
    class Opaque {
      value = expression;
    }
    Object.assign(input, { callback: () => expression, regex: /expression/, instance: new Opaque(), absent: null });

    const paths = findUnsupportedExpressions(input, () => false);

    expect(paths).toEqual(["config.first.value", "config.second.value"]);
  });

  it("passes prefixed paths to support classification", () => {
    const paths = findUnsupportedExpressions(
      { name: `  ${expression}`, unsupported: expression },
      (path) => path.length === 4 && path[3] === "name",
      ["plugins", "custom-plugin", "options"],
    );

    expect(paths).toEqual(['config.plugins["custom-plugin"].options.unsupported']);
  });
});

describe("effective core inputs", () => {
  it("replaces only the selected nested resolution path and omits plugins", () => {
    const config = {
      resolutions: { knownIssuesPath: expression, rules: [{ name: expression }] },
      plugins: { ignored: { options: { title: expression } } },
    } as unknown as Config;

    const paths = findUnsupportedCoreExpressions(config, { resolutions: { knownIssuesPath: "safe" } });

    expect(paths).toEqual(["config.resolutions.rules[0].name"]);
  });
});

describe("core expression support", () => {
  it.each([
    ["name"],
    ["hideLabels", 0],
    ["environments", "linux", "name"],
    ["environments", "linux", "matcher"],
    ["categories", 0, "name"],
    ["categories", 0, "matchers"],
    ["categories", "rules", 0, "name"],
    ["categories", "rules", 0, "matchers", 0],
    ["allureService", "accessToken"],
    ["qualityGate", "enabled"],
    ["qualityGate", "use", 0, "message"],
    ["qualityGate", "use", 0, "successMessage"],
    ["qualityGate", "rules", 0, "filter"],
    ["qualityGate", "rules", 0, "custom"],
    ["qualityGate", "rules", 0, "custom", "nested", 0],
  ])("recognizes supported path %j", (...path) => {
    expect(supportsCoreExpression(path)).toBe(true);
  });

  it.each([
    ["output"],
    ["name", "nested"],
    ["hideLabels", "value"],
    ["environments", "linux", "description"],
    ["categories", 0, "matchers", "message"],
    ["categories", 0, "matchers", 0, "message"],
    ["allureService", "url"],
    ["qualityGate", "use", 0, "rule"],
    ["qualityGate", "rules", 0, "id"],
    ["qualityGate", "rules", 0, "fastFail"],
    ["qualityGate", "rules", 0, "filter", "nested"],
  ])("rejects unsupported path %j", (...path) => {
    expect(supportsCoreExpression(path)).toBe(false);
  });
});

describe("plugin expression support", () => {
  const fields: PluginExpressionFields = {
    name: "name",
    custom: (source) => source,
    sections: { items: { title: "name", fields: { items: { header: "name" } } } },
  };

  it.each([
    { path: ["name"], supported: true },
    { path: ["custom"], supported: true },
    { path: ["sections", 0, "title"], supported: true },
    { path: ["sections", 0, "fields", 0, "header"], supported: true },
    { path: ["sections", 0, "unknown"], supported: false },
    { path: ["sections", "title"], supported: false },
    { path: ["sections", 0], supported: false },
    { path: ["name", "nested"], supported: false },
    { path: ["missing"], supported: false },
  ])("classifies $path as $supported", ({ path, supported }) => {
    expect(supportsPluginExpression(fields, path)).toBe(supported);
  });

  it("treats options without metadata as unsupported", () => {
    expect(supportsPluginExpression(undefined, ["name"])).toBe(false);
  });
});
