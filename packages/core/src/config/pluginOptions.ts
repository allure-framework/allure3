import { compileExpression, isExpression } from "./expressions.js";
import { compileCsvAccessor, compileCsvComparator } from "./pluginExpressions.js";

type PluginKind = "awesome" | "classic" | "csv" | "dashboard" | "log" | "testops";
let builtinPlugins: Promise<Map<unknown, PluginKind>> | undefined;

const getBuiltinPlugins = () => {
  builtinPlugins ??= Promise.all([
    import("@allurereport/plugin-awesome"),
    import("@allurereport/plugin-classic"),
    import("@allurereport/plugin-csv"),
    import("@allurereport/plugin-dashboard"),
    import("@allurereport/plugin-log"),
    import("@allurereport/plugin-testops"),
  ]).then(
    ([awesome, classic, csv, dashboard, log, testops]) =>
      new Map<unknown, PluginKind>([
        [awesome.default, "awesome"],
        [classic.default, "classic"],
        [csv.default, "csv"],
        [dashboard.default, "dashboard"],
        [log.default, "log"],
        [testops.default, "testops"],
      ]),
  );
  return builtinPlugins;
};

/** Normalize supported built-in options without interpreting third-party configuration. */
export const resolvePluginOptions = async (
  Plugin: unknown,
  options: Record<string, any> | undefined,
  path: string,
  env: Record<string, string>,
): Promise<Record<string, any> | undefined> => {
  if (
    !options ||
    !(
      typeof options.filter === "string" ||
      typeof options.qualityGateFilter === "string" ||
      typeof options.sort === "string" ||
      (Array.isArray(options.fields) &&
        options.fields.some((field) => typeof field?.accessor === "string" && isExpression(field.accessor)))
    )
  ) {
    return options;
  }
  const kind = (await getBuiltinPlugins()).get(Plugin);
  if (!kind) {
    return options;
  }
  const normalized = { ...options };
  if (typeof options.filter === "string") {
    const evaluate = compileExpression(
      options.filter,
      `${path}.filter`,
      { test: "map", env: "map" },
      { resultType: "bool" },
    );
    normalized.filter = (test: unknown) => evaluate({ test, env });
  }
  if (kind === "log" && typeof options.qualityGateFilter === "string") {
    const evaluate = compileExpression(
      options.qualityGateFilter,
      `${path}.qualityGateFilter`,
      { result: "map", env: "map" },
      { resultType: "bool" },
    );
    normalized.qualityGateFilter = (result: unknown) => evaluate({ result, env });
  }
  if (kind === "csv") {
    if (Array.isArray(options.fields)) {
      normalized.fields = options.fields.map((field, index) =>
        typeof field?.accessor === "string" && isExpression(field.accessor)
          ? { ...field, accessor: compileCsvAccessor(field.accessor, `${path}.fields[${index}].accessor`, env) }
          : field,
      );
    }
    if (typeof options.sort === "string") {
      normalized.sort = compileCsvComparator(options.sort, `${path}.sort`, env);
    }
  }
  return normalized;
};
