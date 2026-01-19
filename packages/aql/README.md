# Allure Query Language for TypeScript

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## What is AQL?

Allure Query Language (AQL) is a domain-specific language designed for querying and filtering objects. It provides a simple, SQL-like syntax for expressing complex filtering conditions.

**Key characteristics:**

- **Simple syntax** - Easy to read and write, similar to SQL WHERE clauses
- **Type-safe** - Full TypeScript support with typed AST nodes
- **Extensible** - Support for custom functions and context values
- **Compatible** - Fully compatible with Allure TestOps Java implementation

**Example AQL expressions:**

- `'status = "passed"'` - Simple equality check
- `'status = "passed" AND duration < 100'` - Multiple conditions
- `'status IN ["passed", "failed"]'` - Array membership
- `'cf["Priority"] = "High"'` - Nested property access

## Overview

This package provides a TypeScript parser that converts AQL expressions into an Abstract Syntax Tree (AST), enabling programmatic filtering and validation of test data. The parser is fully compatible with the Allure TestOps implementation and supports all standard AQL features including operations, logical operators, parentheses, and context functions.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/aql
yarn add @allurereport/aql
pnpm add @allurereport/aql
```

## Features

- ✅ **Full AQL expression parsing** - Parse any valid AQL expression into an AST
- ✅ **All comparison operations** - Support for `>`, `>=`, `<`, `<=`, `=`, `!=`, `~=`, `IN`
  - Example: `'status = "passed" AND age > 25'`
- ✅ **Logical operators** - Complete support for `AND`, `OR`, `NOT`
  - Example: `'(status = "passed" OR status = "failed") AND name ~= "test"'`
- ✅ **Parentheses for grouping** - Control operator precedence with parentheses
  - Example: `'(a = 1 OR b = 2) AND c = 3'`
- ✅ **Array/object access** - Access nested properties via `identifier[key]`
  - Example: `'cf["Custom Field"] = "value"'`
- ✅ **Context functions** - Support for dynamic values like `now()`, `currentUser()`
  - Example: `"createdDate >= now()"`
- ✅ **Type-safe validation** - Typed errors with detailed information for localization

## Usage

### Basic example

```typescript
import { parseAql } from "@allurereport/aql";

// Parse a simple AQL expression
const result = parseAql('status = "passed"');

// result.expression contains the parsed AST
console.log(result.expression);
// {
//   type: "condition",
//   left: { identifier: "status" },
//   operator: "EQ",
//   right: { value: "passed", type: "STRING" }
// }
```

### With context

```typescript
import { parseAql } from "@allurereport/aql";

// Provide context for function calls like now() or currentUser()
const context = {
  "now()": Date.now(), // Current timestamp
  "currentUser()": "admin", // Current user identifier
};

// Functions in AQL will be resolved using the context
const result = parseAql("createdDate >= now()", context);
// The parser replaces now() with the value from context
```

### With configuration

```typescript
import { parseAql } from "@allurereport/aql";

// Restrict available features for security or validation
const config = {
  operations: ["EQ", "NEQ"], // Only allow equality checks
  identifiers: ["status", "name"], // Only allow specific fields
  logicalOperators: ["AND"], // Only allow AND operator
};

// This will succeed
const result = parseAql('status = "passed" AND name = "test"', undefined, config);

// This will throw an error (OR is not allowed)
// parseAql('status = "passed" OR name = "test"', undefined, config);
```

### Validation

```typescript
import { isAqlError, parseAql } from "@allurereport/aql";

try {
  const result = parseAql('status = "passed"');
} catch (error) {
  if (isAqlError(error)) {
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error details:", error.details);
  }
}
```

## Supported Operations

- `>` - greater than (e.g., `age > 25`)
- `>=` - greater than or equal (e.g., `score >= 80`)
- `<` - less than (e.g., `duration < 100`)
- `<=` - less than or equal (e.g., `price <= 1000`)
- `=` or `is` - equal (e.g., `status = "passed"` or `status is "passed"`)
- `!=` - not equal (e.g., `status != "broken"`)
- `~=` - contains (substring match, e.g., `name ~= "test"`)
- `IN` - in array (e.g., `status IN ["passed", "failed"]`)

## AQL Expression Examples

```typescript
// Simple condition - check if status equals "passed"
'status = "passed"';

// Logical operators - combine multiple conditions
'status = "passed" AND name ~= "test"';

// Parentheses - control operator precedence
// This means: (status is passed OR failed) AND name contains "test"
'(status = "passed" OR status = "failed") AND name ~= "test"';

// Comparison operations - numeric comparisons
"createdDate >= 1234567890";

// Array condition - check if value is in a list
'status IN ["passed", "failed", "broken"]';

// Element access - access nested properties or array elements
'cf["Custom Field"] = "value"';

// NOT operator - negate a condition
'NOT status = "passed"';

// Functions - use dynamic values from context
"createdDate >= now()";

// Boolean value - standalone boolean expression
"true";

// NULL values - check for null or empty values
"status = null";
```

## AST Structure

The parser returns an AST (Abstract Syntax Tree) with the following structure:

```typescript
type AqlExpression =
  | AqlConditionExpression // condition: left operator right
  | AqlArrayConditionExpression // array condition: left IN [values]
  | AqlBinaryExpression // binary operation: left AND/OR right
  | AqlNotExpression // negation: NOT expression
  | AqlParenExpression // parentheses: (expression)
  | AqlBooleanExpression; // boolean value: true/false
```

Each expression node contains type information and the necessary data to evaluate or transform the query. The AST can be used for:

- **Filtering** - Evaluate expressions against objects
- **Validation** - Check if expressions are valid
- **Transformation** - Convert to other query languages
- **Analysis** - Extract identifiers, operations, and values

## API

### `parseAql(aql: string, context?: Map | Record, config?: AqlParserConfig): AqlParseResult`

Parses an AQL string and returns an AST (Abstract Syntax Tree).

**Parameters:**

- `aql` - AQL string to parse (e.g., `'status = "passed"'`)
- `context` - optional context with functions (Map or object), e.g., `{ "now()": Date.now() }`
- `config` - optional parser configuration to restrict available features

**Returns:**

- `AqlParseResult` object with `expression` field:
  ```typescript
  {
    expression: AqlExpression | null; // null for empty strings
  }
  ```

**Example return value:**

```typescript
const result = parseAql('status = "passed" AND age > 25');
// result.expression = {
//   type: "binary",
//   operator: "AND",
//   left: {
//     type: "condition",
//     left: { identifier: "status" },
//     operator: "EQ",
//     right: { value: "passed", type: "STRING" }
//   },
//   right: {
//     type: "condition",
//     left: { identifier: "age" },
//     operator: "GT",
//     right: { value: "25", type: "NUMBER" }
//   }
// }
```

**Throws:**

- `AqlParserError` if the AQL string is invalid or uses forbidden features

### `includesAll(aql: string | null | undefined): boolean`

Checks if AQL includes all records (empty string or "true").

## Parser Configuration

You can restrict available features in the parser using `AqlParserConfig`:

```typescript
import { parseAql } from "@allurereport/aql";

const config = {
  // Allow only specific operations
  operations: ["EQ", "NEQ"],

  // Allow only specific logical operators
  logicalOperators: ["AND", "OR"],

  // Allow only specific identifiers
  identifiers: ["status", "name", "age"],

  // Or use a validation function
  identifiers: (id: string) => id.startsWith("custom_"),

  // Allow only specific value types
  valueTypes: ["STRING", "NUMBER"],

  // Disable parentheses
  parentheses: false,

  // Disable bracket access (identifier[key])
  indexAccess: false,
};

const result = parseAql('status = "passed"', undefined, config);
```

### Configuration Options

- `operations?: AqlOperations[]` - Allowed operations (GT, GE, LT, LE, EQ, NEQ, CONTAINS, IN)
- `logicalOperators?: AqlLogicalOperators[]` - Allowed logical operators (AND, OR, NOT)
- `identifiers?: string[] | ((identifier: string) => boolean)` - Allowed identifiers (array or validation function)
- `valueTypes?: AqlValueKind[]` - Allowed value types (NULL, BOOLEAN, NUMBER, STRING, FUNCTION)
- `parentheses?: boolean` - Whether parentheses are allowed (default: `true`)
- `indexAccess?: boolean` - Whether bracket access is allowed (default: `true`)

If a configuration option is not specified, all features are available.

## Filtering Objects

You can filter arrays of objects using AQL expressions. This is useful for filtering test results, user data, or any structured objects:

```typescript
import { filterByAql } from "@allurereport/aql";

// Example: Filter test results
const testResults = [
  { id: 1, name: "Login test", status: "passed", duration: 150, tags: ["smoke"] },
  { id: 2, name: "Logout test", status: "failed", duration: 200, tags: ["regression"] },
  { id: 3, name: "API test", status: "passed", duration: 100, tags: ["smoke", "api"] },
];

// Filter by simple condition - get all passed tests
const passedTests = filterByAql(testResults, 'status = "passed"');
// Returns: [{ id: 1, ... }, { id: 3, ... }]

// Filter with AND - passed tests with duration less than 150ms
const fastPassedTests = filterByAql(testResults, 'status = "passed" AND duration < 150');
// Returns: [{ id: 3, ... }]

// Filter with OR - get passed or failed tests (exclude broken)
const activeTests = filterByAql(testResults, 'status = "passed" OR status = "failed"');
// Returns: all items

// Filter with IN - get tests with specific statuses
const relevantTests = filterByAql(testResults, 'status IN ["passed", "failed"]');
// Returns: all items

// Filter with nested properties - access custom fields
const itemsWithCustomFields = [
  { id: 1, cf: { Priority: "High", Component: "Auth" } },
  { id: 2, cf: { Priority: "Low", Component: "UI" } },
];
const highPriorityAuth = filterByAql(itemsWithCustomFields, 'cf["Priority"] = "High" AND cf["Component"] = "Auth"');
// Returns: [{ id: 1, ... }]
```

### Filter API

#### `filterByAql<T>(items: T[], aql: string, context?: Map | Record, config?: AqlParserConfig): T[]`

Filters an array of objects based on an AQL expression string.

**Parameters:**

- `items` - array of objects to filter
- `aql` - AQL expression string
- `context` - optional context with functions
- `config` - optional parser configuration to restrict available features

**Returns:**

- Filtered array of objects

#### `filterByAql<T>(items: T[], expression: AqlExpression): T[]`

Filters an array of objects using a pre-parsed AQL expression. Useful when you need to filter multiple arrays with the same expression.

**Parameters:**

- `items` - array of objects to filter
- `expression` - parsed AQL expression (from `parseAql()`)

**Returns:**

- Filtered array of objects

**Example:**

```typescript
// Parse once
const parseResult = parseAql('status = "passed"');
if (parseResult.expression) {
  // Use multiple times
  const filtered1 = filterByAql(items1, parseResult.expression);
  const filtered2 = filterByAql(items2, parseResult.expression);
  const filtered3 = filterByAql(items3, parseResult.expression);
}
```

## Error Handling

AQL parser uses typed error classes for better error handling and localization support. All errors include position information and detailed context.

### Error Types

```typescript
import { AqlError, AqlErrorCode, isAqlError } from "@allurereport/aql";

try {
  parseAql("invalid aql");
} catch (error) {
  if (isAqlError(error)) {
    console.log("Error code:", error.code);
    // Example: "EXPECTED_TOKEN"

    console.log("Error message:", error.message);
    // Example: "Expected '=' at position 7"

    console.log("Error details:", error.fullDetails);
    // Example: { expected: "=", actual: "!", position: 7, context: "status !" }

    // Use error.code for translation keys in your UI
  }
}
```

### Common Error Examples

```typescript
// Syntax error - unexpected character
try {
  parseAql('status @ "passed"');
} catch (error) {
  // error.code = "UNEXPECTED_CHARACTER"
  // error.message = "Unexpected character '@' at position 7"
}

// Unterminated string
try {
  parseAql('status = "passed');
} catch (error) {
  // error.code = "UNTERMINATED_STRING"
  // error.message = "Unterminated string at position 7"
}

// Expected token
try {
  parseAql("status =");
} catch (error) {
  // error.code = "EXPECTED_TOKEN"
  // error.message = "Expected value at position 9"
}

// Forbidden operation (with config)
try {
  const config = { operations: ["EQ"] };
  parseAql('status > "passed"', undefined, config);
} catch (error) {
  // error.code = "FORBIDDEN_OPERATION"
  // error.message = "Operation 'GT' is not allowed at position 7"
}
```

### Error Codes

- `UNEXPECTED_CHARACTER` - Unexpected character in input
- `UNTERMINATED_STRING` - String literal not properly closed
- `INVALID_UNICODE_ESCAPE` - Invalid Unicode escape sequence
- `EXPECTED_TOKEN` - Expected specific token
- `EXPECTED_OPERATION` - Expected operation
- `EXPECTED_VALUE` - Expected value
- `EXPECTED_ACCESSOR` - Expected accessor
- `INVALID_INPUT` - Invalid input
- `INVALID_SYNTAX` - Invalid syntax

### Error Classes

- `AqlError` - Base error class
- `AqlTokenizerError` - Tokenizer-specific errors
- `AqlParserError` - Parser-specific errors

### Localization Example

```typescript
import { AqlError, AqlErrorCode } from "@allurereport/aql";

function translateError(error: AqlError, locale: string): string {
  const translations = {
    en: {
      [AqlErrorCode.EXPECTED_TOKEN]: "Expected {expected} at position {position}",
      // ... more translations
    },
    es: {
      [AqlErrorCode.EXPECTED_TOKEN]: "Se esperaba {expected} en la posición {position}",
      // ... more translations
    },
  };

  const template = translations[locale]?.[error.code];
  const details = error.fullDetails;
  return template.replace(/\{(\w+)\}/g, (_, key) => details[key]?.toString() || "");
}
```

## Compatibility

The parser is compatible with the Java implementation in `allure-query-language` and uses the same ANTLR grammar.
