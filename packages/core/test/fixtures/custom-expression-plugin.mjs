import { compileExpression, isExpression } from "@allurereport/core-api";

const resolveAccessor = (source, { path, env }) => {
  if (!isExpression(source)) {
    return source;
  }
  const evaluate = compileExpression(source, path, { item: "map", env: "map" });
  return (item) => evaluate({ item, env });
};

export default class CustomExpressionPlugin {
  static configExpressions = {
    fields: { items: { accessor: resolveAccessor } },
  };

  constructor(options) {
    this.options = options;
  }
}
