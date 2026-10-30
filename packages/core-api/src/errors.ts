/** A configuration expression failure that result readers must not treat as malformed input. */
export class ExpressionError extends Error {
  override name = "ExpressionError";
}
