import type {
  AqlArrayConditionExpression,
  AqlBinaryExpression,
  AqlConditionExpression,
  AqlExpression,
} from "@allurereport/aql";
import {
  aqlArrayConditionExpression,
  aqlBinaryExpression,
  aqlConditionExpression,
  aqlParenExpression,
  createAqlPredicate,
} from "@allurereport/aql";
import {
  type AqlValueType,
  type FieldFilter,
  type FieldFilterGroup,
  type Filter,
  MAX_ARRAY_FIELD_VALUES,
} from "./model.js";

const buildAqlFromFieldFilter = (
  field: FieldFilter,
): AqlConditionExpression | AqlArrayConditionExpression | AqlBinaryExpression => {
  const { value: fieldValue } = field;
  const { key, type, strict, value } = fieldValue;

  // Handle array fields
  if (type === "array") {
    if (value.length === 0) {
      throw new Error("ArrayField value cannot be empty");
    }

    if (strict === false) {
      return buildArrayIntersectionFilter(key, value, MAX_ARRAY_FIELD_VALUES);
    }

    return aqlArrayConditionExpression({
      type: "arrayCondition",
      left: {
        identifier: key,
      },
      operator: "IN",
      right: value.map((item) => ({
        value: item,
        type: "STRING",
      })),
    });
  }

  // Determine the expression value and type based on field type
  let expressionValue: string;
  let valueType: AqlValueType;
  let operator: "EQ" | "CONTAINS" = "EQ";

  switch (type) {
    case "number": {
      expressionValue = String(value);
      operator = (strict ?? true) ? "EQ" : "CONTAINS";
      valueType = "NUMBER";
      break;
    }
    case "boolean": {
      expressionValue = value ? "true" : "false";
      valueType = "BOOLEAN";
      operator = "EQ";
      break;
    }
    case "string": {
      expressionValue = String(value);
      operator = (strict ?? true) ? "EQ" : "CONTAINS";
      valueType = "STRING";
      break;
    }
    default: {
      // This should never happen with proper TypeScript typing
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported field type: ${String(exhaustiveCheck)}`);
    }
  }

  return aqlConditionExpression({
    type: "condition",
    left: {
      identifier: key,
    },
    operator,
    right: {
      value: expressionValue,
      type: valueType,
    },
  });
};

/**
 * Chains multiple field filters together using binary expressions.
 *
 * @param filters - Array of field filters to chain
 * @returns A chained AQL expression
 * @throws {Error} If filters array is empty
 *
 * @example
 * ```typescript
 * const filters = [
 *   { ...filter1, chain: "AND" },
 *   { ...filter2, chain: "OR" },
 *   filter3
 * ];
 * const chained = chainFieldFilters(filters);
 * ```
 */
export const buildFieldFilters = <T extends string = string>(filters: Filter<T>[]): AqlExpression => {
  if (filters.length === 0) {
    throw new Error("chainFieldFilters: filters array cannot be empty");
  }

  const buildAqlFromFilterGroup = (group: FieldFilterGroup) => {
    const { value } = group;

    if (value.length === 0) {
      throw new Error("buildFieldFilters: value array cannot be empty");
    }

    if (value.length === 1) {
      return buildFieldFilters([value[0]]);
    }

    return aqlParenExpression({
      type: "paren",
      expression: buildFieldFilters(value),
    });
  };

  if (filters.length === 1) {
    const [filter] = filters;

    if (filter.type === "field") {
      return buildAqlFromFieldFilter(filter);
    }

    return buildAqlFromFilterGroup(filter);
  }

  const [first, second, ...rest] = filters;

  if (rest.length === 0) {
    return aqlBinaryExpression({
      type: "binary",
      operator: first.logicalOperator ?? "AND",
      left: buildFieldFilters([first]),
      right: buildFieldFilters([second]),
    });
  }

  return rest.reduce(
    (acc, filter) => {
      return aqlBinaryExpression({
        type: "binary",
        operator: filter.logicalOperator ?? "AND",
        left: acc,
        right: buildFieldFilters([filter]),
      });
    },
    buildFieldFilters([first, second]),
  );
};

/**
 * Builds an AQL expression for array intersection check.
 * Generates OR conditions for each value in the filter array, checking array elements by index.
 * Note: This approach is limited by the maxIndex parameter (default: 20).
 * For arrays longer than maxIndex, some elements may not be checked.
 *
 * The generated expression checks: (tags[0] = "value1" OR tags[1] = "value1" OR ...) OR (tags[0] = "value2" OR ...)
 *
 * @param key - The array field key to check
 * @param values - Array of values to check for intersection
 * @param maxIndex - Maximum array index to check (default: 20)
 * @returns AQL expression that checks if the array contains any of the specified values
 *
 * @example
 * ```typescript
 * // Check if tags array contains "smoke" or "regression"
 * const expr = buildArrayIntersectionFilter("tags", ["smoke", "regression"]);
 * const predicate = createAqlPredicate(expr);
 * const filtered = items.filter(predicate);
 * ```
 */
const buildArrayIntersectionFilter = (key: string, values: string[], maxIndex: number = 20) => {
  if (values.length === 0) {
    throw new Error("buildArrayIntersectionFilter: values array cannot be empty");
  }

  // Generate conditions for each value: tags[0] = "value" OR tags[1] = "value" OR ... OR tags[maxIndex] = "value"
  const conditionsPerValue = values.map((value) => {
    const indexConditions = Array.from({ length: maxIndex + 1 }, (_, index) => {
      return aqlConditionExpression({
        type: "condition",
        left: {
          identifier: key,
          param: {
            value: index,
            type: "number",
          },
        },
        operator: "EQ",
        right: {
          value,
          type: "STRING",
        },
      });
    });

    // Chain index conditions with OR for each value
    if (indexConditions.length === 1) {
      return indexConditions[0];
    }

    return indexConditions.reduce<AqlConditionExpression | AqlBinaryExpression>((acc, condition, index) => {
      if (index === 0) {
        return condition;
      }
      return aqlBinaryExpression({
        type: "binary",
        operator: "OR",
        left: acc,
        right: condition,
      });
    }, indexConditions[0]);
  });

  // Chain all value conditions with OR
  if (conditionsPerValue.length === 1) {
    return conditionsPerValue[0];
  }

  return conditionsPerValue.reduce<AqlConditionExpression | AqlBinaryExpression>((acc, condition, index) => {
    if (index === 0) {
      return condition;
    }
    return aqlBinaryExpression({
      type: "binary",
      operator: "OR",
      left: acc,
      right: condition,
    });
  }, conditionsPerValue[0]);
};

export const buildFilterPredicate = <Keys extends string = string>(filters: Filter<Keys>[]) => {
  return createAqlPredicate(buildFieldFilters<Keys>(filters)) as (item: Record<Keys, any>) => boolean;
};
