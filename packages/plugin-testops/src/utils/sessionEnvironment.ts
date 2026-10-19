/**
 * Prepares config variables for a TestOps session: drops the ones without a value (e.g. an unset `process.env.X`
 * in a JS config, an empty YAML value or an empty string) and stringifies the rest,
 * so TestOps never gets "undefined", "null" or empty values.
 */
export const toSessionVariables = (variables: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(variables)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)] as const)
      .filter(([, value]) => value.trim() !== ""),
  );

/**
 * Whether an environment's variables (report variables merged with its own) differ from the report-level ones.
 * TestOps matches session keys case-sensitively, so keys are compared as is.
 */
export const hasOwnVariables = (
  reportVariables: Record<string, string>,
  environmentVariables: Record<string, string>,
): boolean =>
  Object.keys({ ...reportVariables, ...environmentVariables }).some(
    (key) => reportVariables[key] !== environmentVariables[key],
  );
