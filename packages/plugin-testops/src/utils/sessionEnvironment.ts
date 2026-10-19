/**
 * Prepares config variables for a TestOps session: keeps strings, numbers and booleans as strings and drops
 * everything else, such as an unset `process.env.X` in a JS config, an empty YAML value, an empty string
 * or a nested object, so config variables never send "undefined", "null", "[object Object]" or empty values.
 */
export const toSessionVariables = (variables: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(variables)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, String(value)] as const)
      .filter(([, value]) => value.trim() !== ""),
  );
