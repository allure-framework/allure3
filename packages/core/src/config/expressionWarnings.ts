import { isExpression } from "@allurereport/core-api/expression";
import type { Config, PluginExpressionFields } from "@allurereport/plugin-api";

import type { ConfigOverride } from "../config.js";

export type ConfigExpressionPath = readonly (string | number)[];

// Override precedence only; expression support is defined by supportsCoreExpression.
// Keep this list and findUnsupportedCoreExpressions in sync with resolveConfig in ../config.ts:
// scalar values use override.x ?? config.x; resolutions merge separately and plugins replace the map.
const CORE_CONFIG_NULLISH_OVERRIDE_KEYS = [
  "name",
  "output",
  "open",
  "port",
  "host",
  "hideLabels",
  "historyPath",
  "historyBaseUrl",
  "historyLimit",
] as const satisfies readonly (keyof ConfigOverride)[];

const SEPARATELY_SELECTED_CORE_CONFIG_KEYS = new Set<string>([
  "plugins",
  "resolutions",
  ...CORE_CONFIG_NULLISH_OVERRIDE_KEYS,
]);

const formatPath = (path: ConfigExpressionPath): string =>
  path.reduce<string>(
    (result, segment) =>
      typeof segment === "number"
        ? `${result}[${segment}]`
        : /^[A-Za-z_$][\w$]*$/.test(segment)
          ? `${result}.${segment}`
          : `${result}[${JSON.stringify(segment)}]`,
    "config",
  );

export const findUnsupportedExpressions = (
  value: unknown,
  supports: (path: ConfigExpressionPath) => boolean,
  prefix: ConfigExpressionPath = [],
): string[] => {
  const paths: string[] = [];
  const ancestors = new Set<object>();
  const visit = (input: unknown, path: ConfigExpressionPath): void => {
    if (typeof input === "string") {
      if (isExpression(input) && !supports(path)) {
        paths.push(formatPath(path));
      }
      return;
    }
    if (typeof input !== "object" || input === null || ancestors.has(input)) {
      return;
    }
    const array = Array.isArray(input);
    if (!array && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) {
      return;
    }
    ancestors.add(input);
    try {
      if (array) {
        input.forEach((item, index) => visit(item, [...path, index]));
      } else {
        Object.entries(input).forEach(([key, item]) => visit(item, [...path, key]));
      }
    } finally {
      ancestors.delete(input);
    }
  };
  visit(value, prefix);
  return paths;
};

/** Inspect effective raw inputs, never the values returned by expression evaluation. */
export const findUnsupportedCoreExpressions = (config: Config, override: ConfigOverride): string[] => {
  const effective = Object.fromEntries(
    Object.keys(config)
      .filter((key) => !SEPARATELY_SELECTED_CORE_CONFIG_KEYS.has(key))
      .map((key) => [key, config[key as keyof Config]]),
  );
  for (const key of CORE_CONFIG_NULLISH_OVERRIDE_KEYS) {
    Object.assign(effective, { [key]: override[key] ?? config[key] });
  }
  if (config.resolutions || override.resolutions) {
    effective.resolutions = {
      ...config.resolutions,
      knownIssuesPath: override.resolutions?.knownIssuesPath ?? config.resolutions?.knownIssuesPath,
    } as Config["resolutions"];
  }
  return findUnsupportedExpressions(
    effective,
    (path) => !(path[0] === "name" && override.name != null) && supportsCoreExpression(path),
  );
};

// Keep this capability map in sync with resolveName in ../config.ts and the evaluators in
// hideLabels.ts, environments.ts, categories.ts, allureService.ts, qualityGate.ts, and qualityGateValues.ts.
// New expression-enabled fields in those resolvers must also be classified here.
export const supportsCoreExpression = (path: ConfigExpressionPath): boolean => {
  const [root, field, index, key] = path;
  if (root === "name") {
    return path.length === 1;
  }
  if (root === "hideLabels") {
    return path.length === 2 && typeof field === "number";
  }
  if (root === "environments") {
    return path.length === 3 && typeof field === "string" && (index === "name" || index === "matcher");
  }
  if (root === "allureService") {
    return path.length === 2 && field === "accessToken";
  }
  if (root === "categories") {
    const rulePath = field === "rules" ? path.slice(2) : path.slice(1);
    const [ruleIndex, ruleField, matcherIndex] = rulePath;
    return (
      typeof ruleIndex === "number" &&
      ((rulePath.length === 2 && (ruleField === "name" || ruleField === "matchers")) ||
        (rulePath.length === 3 && ruleField === "matchers" && typeof matcherIndex === "number"))
    );
  }
  if (root !== "qualityGate") {
    return false;
  }
  if (field === "enabled") {
    return path.length === 2;
  }
  if (typeof index !== "number") {
    return false;
  }
  if (field === "use") {
    return path.length === 4 && (key === "message" || key === "successMessage");
  }
  if (field === "rules" && typeof key === "string") {
    return key === "filter" ? path.length === 4 : key !== "id" && key !== "fastFail";
  }
  return false;
};

export const supportsPluginExpression = (
  fields: PluginExpressionFields | undefined,
  path: ConfigExpressionPath,
): boolean => {
  const [key, index, ...rest] = path;
  if (!fields || typeof key !== "string" || !Object.hasOwn(fields, key)) {
    return false;
  }
  const declaration = fields[key];
  if (typeof declaration === "string" || typeof declaration === "function") {
    return path.length === 1;
  }
  return typeof index === "number" && supportsPluginExpression(declaration.items, rest);
};
