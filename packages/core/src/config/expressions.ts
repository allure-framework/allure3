import { Environment } from "@marcbachmann/cel-js";

export const isExpression = (value: string): boolean => value.trimStart().startsWith("${{");

/** CEL's dynamic type: rule-specific values are type-checked when the expression runs. */
export const CEL_DYNAMIC_TYPE = "dyn";

type Variables = Record<string, "string" | "map" | "list" | typeof CEL_DYNAMIC_TYPE>;
type Predicate = (context: Record<string, unknown>) => boolean;
type ExpressionOptions = { resultType?: "bool" | "string" };

/** Copy only plain data into the evaluator, never live objects or capabilities. */
const snapshotContext = (context: Record<string, unknown>, variables: Variables): Record<string, unknown> => {
  const ancestors = new Set<object>();

  const copy = (value: unknown): unknown => {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      return value;
    }
    if (
      typeof value !== "object" ||
      value === null ||
      ancestors.has(value) ||
      (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    ) {
      throw new Error("expression context must contain only finite numbers and plain data");
    }
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        return value.map(copy);
      }
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => [key, copy(item)]),
      );
    } finally {
      ancestors.delete(value);
    }
  };

  return Object.fromEntries(Object.keys(variables).map((key) => [key, copy(context[key])]));
};

/** Compile once and report failures with the configuration path. */
export const compileExpression = (
  input: string,
  path: string,
  variables: Variables,
  options: ExpressionOptions = {},
): ((context: Record<string, unknown>) => unknown) => {
  const failure = (error: unknown) =>
    new Error(`Invalid expression at ${path}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  try {
    const wrapped = input.trim();
    if (!wrapped.startsWith("${{") || !wrapped.endsWith("}}")) {
      throw new Error("expected an expression wrapped in ${{ ... }}");
    }
    const source = wrapped.slice(3, -2).trim();
    const environment = new Environment({
      unlistedVariablesAreDyn: false,
    });
    for (const [name, type] of Object.entries(variables)) {
      environment.registerVariable(name, type);
    }
    const expression = environment.parse(source);
    const checked = expression.check();
    if (!checked.valid) {
      throw checked.error;
    }
    if (options.resultType && checked.type !== options.resultType && checked.type !== CEL_DYNAMIC_TYPE) {
      throw new TypeError(`expression must return a ${options.resultType === "bool" ? "boolean" : "string"}`);
    }

    return (context) => {
      try {
        const result: unknown = expression(snapshotContext(context, variables));
        if (options.resultType && typeof result !== (options.resultType === "bool" ? "boolean" : "string")) {
          throw new TypeError(`expression must return a ${options.resultType === "bool" ? "boolean" : "string"}`);
        }
        return result;
      } catch (error) {
        throw failure(error);
      }
    };
  } catch (error) {
    throw failure(error);
  }
};

/** Compile a boolean predicate; compilation and evaluation errors propagate. */
export const compilePredicate = (input: string, path: string, variables: Variables): Predicate => {
  const expression = compileExpression(input, path, variables, { resultType: "bool" });
  return (context) => expression(context) === true;
};
