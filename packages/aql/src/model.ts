/**
 * Types for AQL (Allure Query Language) parsing
 */

export type AqlValueKind = "NULL" | "BOOLEAN" | "NUMBER" | "STRING" | "FUNCTION";

/**
 * Token types for AQL tokenizer.
 */
export type AqlTokenType =
  | AqlOperations
  | AqlLogicalOperators
  | AqlValueKind
  | "IDENTIFIER"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "COMMA"
  | "EOL"
  | "WS";

/**
 * Token interface for AQL tokenizer.
 */
export interface AqlToken {
  type: AqlTokenType;
  /**
   * Token value. Required only for tokens that carry data:
   * - STRING: string value with quotes
   * - NUMBER: numeric value
   * - IDENTIFIER: identifier name
   * - FUNCTION: function name with "()"
   * - BOOLEAN: "true" or "false"
   * Optional for operators, keywords, brackets, and EOL tokens.
   */
  value?: string;
  position: number;
}

/**
 * AQL operation types.
 */
export const AqlOperation = {
  /** Greater than: > */
  GT: "GT",
  /** Greater than or equal: >= */
  GE: "GE",
  /** Less than: < */
  LT: "LT",
  /** Less than or equal: <= */
  LE: "LE",
  /** Equal: = or is */
  EQ: "EQ",
  /** Not equal: != */
  NEQ: "NEQ",
  /** Contains: ~= */
  CONTAINS: "CONTAINS",
  /** In array: IN */
  IN: "IN",
} as const;

export type AqlOperations = (typeof AqlOperation)[keyof typeof AqlOperation];

export const AqlOperationAliases = {
  [AqlOperation.EQ]: "=",
  [AqlOperation.NEQ]: "!=",
  [AqlOperation.GT]: ">",
  [AqlOperation.GE]: ">=",
  [AqlOperation.LT]: "<",
  [AqlOperation.LE]: "<=",
  [AqlOperation.CONTAINS]: "~=",
} as const;

export type AqlOperationAlias = (typeof AqlOperationAliases)[keyof typeof AqlOperationAliases];

/**
 * AQL operation with string literal aliases for backward compatibility.
 * Includes both enum values (e.g., AqlOperation.EQ) and string literals (e.g., "=").
 */
export type AqlOperationOrAlias = AqlOperations | AqlOperationAlias;

/**
 * AQL logical operators.
 */
export const AqlLogicalOperator = {
  /** Logical AND */
  AND: "AND",
  /** Logical OR */
  OR: "OR",
  /** Logical NOT */
  NOT: "NOT",
} as const;

export type AqlLogicalOperators = (typeof AqlLogicalOperator)[keyof typeof AqlLogicalOperator];

export interface AqlValue {
  value: string;
  type: AqlValueKind;
}

export interface AqlAccessor {
  identifier: string;
  param?: {
    value: string | number;
    type: "string" | "number";
  };
}

type AqlConditionOperator = Exclude<AqlOperations, "IN">;

export interface AqlConditionExpression {
  type: "condition";
  left: AqlAccessor;
  operator: AqlConditionOperator;
  right: AqlValue;
}

type AqlArrayOperator = Extract<AqlOperations, "IN">;

export interface AqlArrayConditionExpression {
  type: "arrayCondition";
  left: AqlAccessor;
  operator: AqlArrayOperator;
  right: AqlValue[];
}

type AqlBinaryOperator = Extract<AqlLogicalOperators, "AND" | "OR">;

export interface AqlBinaryExpression {
  type: "binary";
  left: AqlExpression;
  operator: AqlBinaryOperator;
  right: AqlExpression;
}

export interface AqlNotExpression {
  type: "not";
  expression: AqlExpression;
}

export interface AqlParenExpression {
  type: "paren";
  expression: AqlExpression;
}

export interface AqlBooleanExpression {
  type: "boolean";
  value: boolean;
}

export type AqlExpression =
  | AqlConditionExpression
  | AqlArrayConditionExpression
  | AqlBinaryExpression
  | AqlNotExpression
  | AqlParenExpression
  | AqlBooleanExpression;

export interface AqlParseResult {
  expression: AqlExpression | null;
}

/**
 * Configuration for AQL parser to restrict available features.
 *
 * @example
 * ```typescript
 * import { AqlLogicalOperator, AqlOperation } from "./types";
 *
 * const config: AqlParserConfig = {
 *   logicalOperators: [AqlLogicalOperator.AND, AqlLogicalOperator.OR],
 *   operations: [AqlOperation.EQ, AqlOperation.NEQ],
 *   identifiers: ["status", "name"],
 *   valueTypes: ["STRING", "NUMBER"],
 *   parentheses: true,
 *   indexAccess: false,
 * };
 * ```
 */
export interface AqlParserConfig {
  /**
   * Available logical operators (AND, OR, NOT).
   * If not specified, all operators are available.
   *
   * @default undefined (all operators available)
   */
  logicalOperators?: AqlLogicalOperators[];

  /**
   * Available operations (GT, GE, LT, LE, EQ, NEQ, CONTAINS, IN).
   * If not specified, all operations are available.
   *
   * @default undefined (all operations available)
   */
  operations?: AqlOperations[];

  /**
   * Allowed identifiers
   * Can be an array of allowed identifiers or a validation function.
   * If not specified, all identifiers are allowed.
   *
   * @default undefined (all identifiers allowed)
   *
   * @example
   * ```typescript
   * // Array of allowed identifiers
   * identifiers: ["status", "name"]
   *
   * // Validation function
   * identifiers: (identifier) => identifier.startsWith("allowed_")
   * ```
   */
  identifiers?: string[] | ((identifier: string) => boolean);

  /**
   * Available value types (NULL, BOOLEAN, NUMBER, STRING, FUNCTION).
   * If not specified, all value types are available.
   *
   * @default undefined (all value types available)
   */
  valueTypes?: AqlValueKind[];

  /**
   * Whether parentheses are allowed for grouping expressions.
   *
   * @default true
   */
  parentheses?: boolean;

  /**
   * Whether array/object index access via brackets is allowed (e.g., `identifier[key]`).
   *
   * @default true
   */
  indexAccess?: boolean;
}
