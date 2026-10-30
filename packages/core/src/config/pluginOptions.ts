import type { NameContext } from "@allurereport/core-api";
import { type PluginExpressionFields, resolvePluginExpression } from "@allurereport/plugin-api";

/** Normalize only fields declared by the plugin constructor. */
export const resolvePluginOptions = (
  options: Record<string, any> | undefined,
  fields: PluginExpressionFields | undefined,
  path: string,
  context: NameContext,
): Record<string, any> | undefined => {
  if (!options || !fields) {
    return options;
  }
  let normalized = options;
  for (const [key, declaration] of Object.entries(fields)) {
    const value = options[key];
    const fieldPath = `${path}.${key}`;
    let resolved = value;
    if (typeof declaration === "string" || typeof declaration === "function") {
      resolved = resolvePluginExpression(declaration, value, fieldPath, context);
    } else if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        if (item === null || typeof item !== "object" || Array.isArray(item)) {
          continue;
        }
        const entry = resolvePluginOptions(item, declaration.items, `${fieldPath}[${index}]`, context);
        if (entry !== item) {
          if (resolved === value) {
            resolved = value.slice();
          }
          resolved[index] = entry;
        }
      }
    }
    if (resolved !== value) {
      if (normalized === options) {
        normalized = { ...options };
      }
      normalized[key] = resolved;
    }
  }
  return normalized;
};
