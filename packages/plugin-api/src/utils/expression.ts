import { type NameContext, compileExpression, resolveName } from "@allurereport/core-api";

import type { PluginExpressionKind, PluginExpressionResolver } from "../plugin.js";

export const resolvePluginExpression = (
  kind: PluginExpressionKind | PluginExpressionResolver,
  value: unknown,
  path: string,
  context: NameContext,
): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const { env } = context;
  if (typeof kind === "function") {
    return kind(value, { path, env });
  }
  switch (kind) {
    case "name":
      return resolveName(value, path, context);
    case "testFilter": {
      const evaluate = compileExpression(value, path, { test: "map", env: "map" }, { resultType: "bool" });
      return (test: unknown) => evaluate({ test, env });
    }
    case "qualityGateFilter": {
      const evaluate = compileExpression(value, path, { result: "map", env: "map" }, { resultType: "bool" });
      return (result: unknown) => evaluate({ result, env });
    }
  }
};
