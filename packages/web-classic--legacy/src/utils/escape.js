import { escapeExpression } from "handlebars/runtime.js";

export default function escape(source, ...tokens) {
  return source.reduce((result, s, i) => result + escapeExpression(tokens[i - 1]) + s);
}
