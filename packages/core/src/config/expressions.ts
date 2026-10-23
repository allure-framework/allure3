import { Environment } from "@marcbachmann/cel-js";

export const isExpression = (value: string): boolean => value.trimStart().startsWith("${{");

type Variables = Record<string, "string" | "map">;
type Predicate = (context: Record<string, unknown>) => boolean;

/** Copy only bounded plain data into the evaluator, never live objects or capabilities. */
const snapshotContext = (context: Record<string, unknown>, variables: Variables): Record<string, unknown> => {
  let values = 0;
  let characters = 0;

  const copy = (value: unknown, depth: number): unknown => {
    values += 1;
    if (values > 2048 || depth > 8) {
      throw new Error("expression context exceeds structural limits");
    }
    if (typeof value === "string") {
      characters += value.length;
      if (value.length > 16384 || characters > 131072) {
        throw new Error("expression context exceeds string limits");
      }
      return value;
    }
    if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => copy(item, depth + 1));
    }
    if (
      typeof value === "object" &&
      value !== null &&
      [Object.prototype, null].includes(Object.getPrototypeOf(value))
    ) {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => [key, copy(item, depth + 1)]),
      );
    }
    throw new Error("expression context must contain only finite numbers and plain data");
  };

  return Object.fromEntries(Object.keys(variables).map((key) => [key, copy(context[key], 0)]));
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
    if (source.length > 4096) {
      throw new Error("expression exceeds 4096 characters");
    }
    const environment = new Environment({
      unlistedVariablesAreDyn: false,
      limits: { maxAstNodes: 1000, maxDepth: 32, maxListElements: 100, maxMapEntries: 100, maxCallArguments: 16 },
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
