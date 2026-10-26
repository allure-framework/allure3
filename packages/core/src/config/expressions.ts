import { Environment } from "@marcbachmann/cel-js";

export const isExpression = (value: string): boolean => value.trimStart().startsWith("${{");

type Variables = Record<string, "string" | "map">;
type Predicate = (context: Record<string, unknown>) => boolean;

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

/** Compile a synchronous boolean expression once; malformed predicates never match. */
export const compilePredicate = (input: string, path: string, variables: Variables): Predicate => {
  let warned = false;
  const warn = (error: unknown) => {
    if (!warned) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Invalid expression at ${path}: ${message}`);
      warned = true;
    }
  };

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
    if (checked.type !== "bool" && checked.type !== "dyn") {
      throw new TypeError("predicate must return a boolean");
    }

    return (context) => {
      try {
        const result: unknown = expression(snapshotContext(context, variables));
        if (typeof result !== "boolean") {
          throw new TypeError("predicate must return a boolean");
        }
        return result;
      } catch (error) {
        warn(error);
        return false;
      }
    };
  } catch (error) {
    warn(error);
    return () => false;
  }
};
