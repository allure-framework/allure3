/**
 * Utilities for working with AQL
 */
import { AqlOperation, AqlOperationAliases } from "../model.js";
import type {
  AqlArrayConditionExpression,
  AqlBinaryExpression,
  AqlConditionExpression,
  AqlExpression,
  AqlNotExpression,
  AqlOperations,
  AqlParenExpression,
  AqlParserConfig,
  AqlValue,
} from "../model.js";

/**
 * Checks if AQL is empty or includes all records.
 *
 * @param aql - The AQL string to check
 * @returns `true` if AQL is empty, null, undefined, or equals "true"
 *
 * @example
 * ```typescript
 * if (includesAll(aql)) {
 *   // Return all records without filtering
 * }
 * ```
 */
export function includesAll(aql: string | null | undefined): boolean {
  if (!aql || aql.trim() === "") {
    return true;
  }

  const lowerAql = aql.toLowerCase().trim();
  return lowerAql === "true";
}

/**
 * Converts AQL expression to string (reverse transformation).
 *
 * @param expression - The AQL expression to convert
 * @returns AQL string representation of the expression
 *
 * @example
 * ```typescript
 * const expr = parseAql('status = "passed"').expression;
 * const aqlString = expressionToString(expr); // 'status = "passed"'
 * ```
 */
export function expressionToString(expression: AqlExpression): string {
  switch (expression.type) {
    case "condition":
      // eslint-disable-next-line max-len
      return `${accessorToString(expression.left)} ${operationToString(expression.operator)} ${valueToString(expression.right)}`;

    case "arrayCondition":
      // eslint-disable-next-line max-len
      return `${accessorToString(expression.left)} ${expression.operator} [${expression.right.map(valueToString).join(", ")}]`;

    case "binary": {
      const leftStr = expressionToString(expression.left);
      const rightStr = expressionToString(expression.right);
      return `${leftStr} ${expression.operator} ${rightStr}`;
    }

    case "not":
      return `NOT ${expressionToString(expression.expression)}`;

    case "paren":
      return `(${expressionToString(expression.expression)})`;

    case "boolean":
      return expression.value ? "true" : "false";

    default:
      return "";
  }
}

function accessorToString(accessor: {
  identifier: string;
  param?: { value: string | number; type: "string" | "number" };
}): string {
  if (accessor.param) {
    if (accessor.param.type === "string") {
      /**
       * Escape backslashes and quotes in string values (consistent with valueToString)
       */
      const escapedValue = String(accessor.param.value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `${accessor.identifier}["${escapedValue}"]`;
    } else {
      return `${accessor.identifier}[${accessor.param.value}]`;
    }
  }
  return accessor.identifier;
}

const operatorsMap = {
  ...AqlOperationAliases,
  [AqlOperation.IN]: "IN",
} as const;

function operationToString(op: AqlOperations): string {
  return operatorsMap[op] || op;
}

function valueToString(value: AqlValue): string {
  switch (value.type) {
    case "STRING":
      /**
       * Escape quotes and backslashes in string values
       */
      // eslint-disable-next-line no-case-declarations
      const escaped = value.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    case "NULL":
      return "null";
    default:
      return value.value;
  }
}

/**
 * Type helper for AQL expression
 */
export function aqlExpression(expression: AqlExpression): AqlExpression {
  return expression;
}

/**
 * Type helper for AQL condition expression
 */
export function aqlConditionExpression(expression: AqlConditionExpression): AqlConditionExpression {
  return expression;
}

/**
 * Type helper for AQL array condition expression
 */
export function aqlArrayConditionExpression(expression: AqlArrayConditionExpression): AqlArrayConditionExpression {
  return expression;
}

/**
 * Type helper for AQL binary expression
 */
export function aqlBinaryExpression(expression: AqlBinaryExpression): AqlBinaryExpression {
  return expression;
}

/**
 * Type helper for AQL not expression
 */
export function aqlNotExpression(expression: AqlNotExpression): AqlNotExpression {
  return expression;
}

/**
 * Type helper for AQL paren expression
 */
export function aqlParenExpression(expression: AqlParenExpression): AqlParenExpression {
  return expression;
}

/**
 * Type helper for AQL parser config
 */
export function aqlParserConfig(config: AqlParserConfig): AqlParserConfig {
  return config;
}
