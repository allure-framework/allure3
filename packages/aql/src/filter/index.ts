/**
 * AQL filter implementation for filtering objects
 */
import { AqlLogicalOperator, AqlOperation, AqlOperationAliases } from "../model.js";
import type {
  AqlAccessor,
  AqlArrayConditionExpression,
  AqlBinaryExpression,
  AqlBooleanExpression,
  AqlConditionExpression,
  AqlExpression,
  AqlNotExpression,
  AqlOperationOrAlias,
  AqlParenExpression,
  AqlParserConfig,
  AqlValue,
} from "../model.js";
import { parseAql } from "../parser/index.js";

type FilterContext = Map<string, any> | Record<string, any>;

/**
 * Filters an array of objects based on an AQL expression string.
 *
 * @param items - Array of objects to filter
 * @param aql - AQL string expression
 * @param context - Optional context map or object for function values
 * @param config - Optional parser configuration to restrict available features
 * @returns Filtered array of objects
 * @throws {AqlParserError} If the AQL string is invalid or uses forbidden features
 *
 * @example
 * ```typescript
 * const items = [{ status: "passed" }, { status: "failed" }];
 * const filtered = filterByAql(items, 'status = "passed"');
 * // Returns [{ status: "passed" }]
 * ```
 */
export function filterByAql<T extends Record<string, any>>(
  items: T[],
  aql: string,
  context?: FilterContext,
  config?: AqlParserConfig,
): T[];

/**
 * Filters an array of objects based on a parsed AQL expression.
 *
 * @param items - Array of objects to filter
 * @param expression - Pre-parsed AQL expression
 * @returns Filtered array of objects
 *
 * @example
 * ```typescript
 * const expr = parseAql('status = "passed"').expression;
 * const filtered = filterByAql(items, expr);
 * ```
 */
export function filterByAql<T extends Record<string, any>>(items: T[], expression: AqlExpression): T[];

export function filterByAql<T extends Record<string, any>>(
  items: T[],
  aqlOrExpression: string | AqlExpression,
  context?: FilterContext,
  config?: AqlParserConfig,
): T[] {
  let expression: AqlExpression | null = null;

  if (typeof aqlOrExpression === "string") {
    const aql = aqlOrExpression;
    if (!aql || aql.trim() === "") {
      return items;
    }

    const parseResult = parseAql(aql, context, config);
    if (!parseResult.expression) {
      return items;
    }
    expression = parseResult.expression;
  } else {
    expression = aqlOrExpression;
  }

  if (!expression) {
    return items;
  }

  const predicate = createAqlPredicate(expression);
  return items.filter(predicate);
}

const alwaysTruePredicate = () => true;

/**
 * Creates a predicate function from an AQL expression.
 *
 * @param expression - The AQL expression to convert to a predicate
 * @returns A predicate function that takes an item and returns a boolean
 * @private
 */
export function createAqlPredicate(expression: AqlExpression): (item: any) => boolean {
  switch (expression.type) {
    case "condition":
      return createConditionPredicate(expression);

    case "arrayCondition":
      return createArrayConditionPredicate(expression);

    case "binary":
      return createBinaryPredicate(expression);

    case "not":
      return createNotPredicate(expression);

    case "paren":
      return createParenPredicate(expression);

    case "boolean":
      return createBooleanPredicate(expression);

    default:
      return alwaysTruePredicate;
  }
}

/**
 * Creates a predicate for a condition expression.
 *
 * @param expression - The condition expression
 * @returns A predicate function that evaluates the condition
 * @private
 */
function createConditionPredicate(expression: AqlConditionExpression): (item: any) => boolean {
  const { left, operator, right } = expression;

  return (item: any) => {
    const leftValue = getAccessorValue(item, left);
    const rightValue = getValue(right);

    return compareValues(leftValue, operator, rightValue);
  };
}

/**
 * Creates a predicate for an array condition expression (e.g., IN).
 *
 * @param expression - The array condition expression
 * @returns A predicate function that evaluates the array condition
 * @private
 */
function createArrayConditionPredicate(expression: AqlArrayConditionExpression): (item: any) => boolean {
  const { left, operator, right } = expression;

  if (operator === AqlOperation.IN) {
    return (item: any) => {
      const leftValue = getAccessorValue(item, left);
      const rightValues = right.map(getValue);

      if (leftValue === null || leftValue === undefined) {
        return false;
      }

      return rightValues.some((rightValue) => {
        if (rightValue === null || rightValue === undefined) {
          return leftValue === null || leftValue === undefined;
        }
        return equals(leftValue, rightValue);
      });
    };
  }

  return () => false;
}

/**
 * Creates a predicate for a binary expression (AND, OR).
 *
 * @param expression - The binary expression
 * @returns A predicate function that evaluates the binary expression
 * @private
 */
function createBinaryPredicate(expression: AqlBinaryExpression): (item: any) => boolean {
  const leftPredicate = createAqlPredicate(expression.left);
  const rightPredicate = createAqlPredicate(expression.right);

  if (expression.operator === AqlLogicalOperator.AND) {
    return (item: any) => leftPredicate(item) && rightPredicate(item);
  }

  if (expression.operator === AqlLogicalOperator.OR) {
    return (item: any) => leftPredicate(item) || rightPredicate(item);
  }

  return () => false;
}

/**
 * Creates a predicate for a NOT expression.
 *
 * @param expression - The NOT expression
 * @returns A predicate function that negates the inner expression
 * @private
 */
function createNotPredicate(expression: AqlNotExpression): (item: any) => boolean {
  const predicate = createAqlPredicate(expression.expression);
  return (item: any) => !predicate(item);
}

/**
 * Creates a predicate for a parenthesized expression.
 *
 * @param expression - The parenthesized expression
 * @returns A predicate function that evaluates the inner expression
 * @private
 */
function createParenPredicate(expression: AqlParenExpression): (item: any) => boolean {
  return createAqlPredicate(expression.expression);
}

/**
 * Creates a predicate for a boolean expression.
 *
 * @param expression - The boolean expression
 * @returns A predicate function that always returns the boolean value
 * @private
 */
function createBooleanPredicate(expression: AqlBooleanExpression): (item: any) => boolean {
  return () => expression.value;
}

/**
 * Gets a value from an object using an accessor.
 * Supports nested access via bracket notation (e.g., `identifier[key]`).
 *
 * @param item - The object to access
 * @param accessor - The accessor specifying the identifier and optional index/key
 * @returns The accessed value or undefined if not found
 * @private
 */
function getAccessorValue(item: any, accessor: AqlAccessor): any {
  let value = item[accessor.identifier];

  if (accessor.param) {
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      value = value[accessor.param.value];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Converts an AqlValue to its JavaScript representation.
 *
 * @param aqlValue - The AQL value to convert
 * @returns The JavaScript value (null, boolean, number, or string)
 * @private
 */
function getValue(aqlValue: AqlValue): any {
  switch (aqlValue.type) {
    case "NULL":
      return null;

    case "BOOLEAN":
      return aqlValue.value.toLowerCase() === "true";

    case "NUMBER": {
      const num = parseFloat(aqlValue.value);
      /**
       * Check for invalid numbers
       */
      if (Number.isNaN(num)) {
        return 0;
      }
      /**
       * Return integer if it's a whole number, otherwise return float
       */
      return Number.isInteger(num) ? parseInt(aqlValue.value, 10) : num;
    }

    case "STRING":
      return aqlValue.value;

    default:
      return aqlValue.value;
  }
}

/**
 * Compares two values based on an operator.
 *
 * @param left - The left operand value
 * @param operator - The comparison operator (GT, GE, LT, LE, EQ, NEQ, CONTAINS or their string aliases: =, !=, >, >=, <, <=, ~=)
 * @param right - The right operand value
 * @returns `true` if the comparison is true, `false` otherwise
 * @private
 */
function compareValues(left: any, operator: AqlOperationOrAlias, right: any): boolean {
  /**
   * Handle null comparisons
   */
  if (right === null || right === undefined) {
    if (operator === AqlOperation.EQ || operator === AqlOperationAliases.EQ) {
      return left === null || left === undefined;
    }
    if (operator === AqlOperation.NEQ || operator === AqlOperationAliases.NEQ) {
      return left !== null && left !== undefined;
    }
    return false;
  }

  if (left === null || left === undefined) {
    return false;
  }

  switch (operator) {
    case AqlOperation.EQ:
    case AqlOperationAliases.EQ:
      return equals(left, right);

    case AqlOperation.NEQ:
    case AqlOperationAliases.NEQ:
      return !equals(left, right);

    case AqlOperation.GT:
    case AqlOperationAliases.GT:
      return compareNumbers(left, right) > 0;

    case AqlOperation.GE:
    case AqlOperationAliases.GE:
      return compareNumbers(left, right) >= 0;

    case AqlOperation.LT:
    case AqlOperationAliases.LT:
      return compareNumbers(left, right) < 0;

    case AqlOperation.LE:
    case AqlOperationAliases.LE:
      return compareNumbers(left, right) <= 0;

    case AqlOperation.CONTAINS:
    case AqlOperationAliases.CONTAINS:
      return contains(left, right);

    default:
      return false;
  }
}

/**
 * Checks if two values are equal.
 * Performs case-insensitive comparison for strings.
 *
 * @param left - The left value to compare
 * @param right - The right value to compare
 * @returns `true` if values are equal, `false` otherwise
 * @private
 */
function equals(left: any, right: any): boolean {
  if (left === right) {
    return true;
  }

  /**
   * String comparison (case-insensitive for strings)
   */
  if (typeof left === "string" && typeof right === "string") {
    return left.toLocaleLowerCase() === right.toLocaleLowerCase();
  }

  /**
   * Number comparison
   */
  if (typeof left === "number" && typeof right === "number") {
    return left === right;
  }

  /**
   * Boolean comparison
   */
  if (typeof left === "boolean" && typeof right === "boolean") {
    return left === right;
  }

  /**
   * Array comparison
   */
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => equals(item, right[index]));
  }

  return false;
}

/**
 * Compares two values as numbers.
 * Converts values to numbers if needed. null/undefined is considered less than any number.
 *
 * @param left - The left value to compare
 * @param right - The right value to compare
 * @returns Negative number if left < right, positive if left > right, 0 if equal
 * @private
 */
function compareNumbers(left: any, right: any): number {
  /**
   * Handle null/undefined
   */
  if (left === null || left === undefined) {
    return -1; // null/undefined is considered less than any number
  }

  /**
   * Optimize: avoid parsing if both are already numbers
   */
  const leftNum = typeof left === "number" ? left : typeof left === "string" ? parseFloat(left) : Number(left);
  const rightNum = typeof right === "number" ? right : typeof right === "string" ? parseFloat(right) : Number(right);

  if (Number.isNaN(leftNum) || Number.isNaN(rightNum)) {
    return 0;
  }

  return leftNum - rightNum;
}

/**
 * Checks if left value contains right value (case-insensitive string comparison).
 *
 * @param left - The value to search in
 * @param right - The value to search for
 * @returns `true` if left contains right, `false` otherwise
 * @private
 */
function contains(left: any, right: any): boolean {
  if (left === null || left === undefined) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const leftStr = String(left).toLocaleLowerCase();
  const rightStr = String(right).toLocaleLowerCase();

  return leftStr.includes(rightStr);
}
