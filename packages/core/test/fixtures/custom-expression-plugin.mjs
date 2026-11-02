import { compileExpression, isExpression } from "@allurereport/core-api/expression";

const resolveAccessor = (source, { path, env, date }) => {
  if (!isExpression(source)) {
    return source;
  }
  const evaluate = compileExpression(source, path, { item: "map", env: "map", date: "map" });
  return (item) => evaluate({ item, env, date });
};

export default class CustomExpressionPlugin {
  static configExpressions = {
    reportName: "name",
    fields: { items: { accessor: resolveAccessor } },
  };

  constructor(options) {
    this.options = options;
  }
}
