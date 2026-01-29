/* eslint-disable @typescript-eslint/no-shadow */

/**
 * Parser for AQL (Allure Query Language)
 */
import { AqlErrors } from "../errors/index.js";
import type {
  AqlAccessor,
  AqlArrayConditionExpression,
  AqlBinaryExpression,
  AqlBooleanExpression,
  AqlConditionExpression,
  AqlExpression,
  AqlLogicalOperators,
  AqlNotExpression,
  AqlOperations,
  AqlParenExpression,
  AqlParseResult,
  AqlParserConfig,
  AqlToken,
  AqlTokenType,
  AqlValue,
  AqlValueKind,
} from "../model.js";
import { AqlLogicalOperator, AqlOperation } from "../model.js";
import { AqlTokenizer } from "../tokenizer/index.js";

/**
 * Parser for AQL (Allure Query Language) expressions.
 * Converts AQL strings into abstract syntax trees (AST).
 */
export class AqlParser {
  private tokens: AqlToken[] = [];
  private position: number = 0;
  private context: Map<string, any> | undefined;
  private config: AqlParserConfig;

  /**
   * Creates a new AQL parser instance.
   *
   * @param input - The AQL string to parse
   * @param context - Optional context map for function values (e.g., `now()`, `currentUser()`)
   * @param config - Optional parser configuration to restrict available features
   * @throws {AqlParserError} If input is not a non-empty string
   */
  constructor(input: string, context: Map<string, any> | undefined = undefined, config: AqlParserConfig = {}) {
    if (!input || typeof input !== "string") {
      throw AqlErrors.invalidInput("Input must be a non-empty string");
    }

    const tokenizer = new AqlTokenizer(input);
    this.tokens = tokenizer.tokenize();
    // Use provided context or create empty Map only when needed
    this.context = context;
    this.config = config;
  }

  /**
   * Parses the AQL string into an abstract syntax tree.
   *
   * @returns The parse result containing the expression or null if input is empty
   * @throws {AqlParserError} If the AQL string is invalid or uses forbidden features
   *
   * @example
   * ```typescript
   * const parser = new AqlParser('status = "passed"');
   * const result = parser.parse();
   * console.log(result.expression); // AqlConditionExpression
   * ```
   */
  parse(): AqlParseResult {
    if (this.reachedEOL) {
      return { expression: null };
    }

    const expression = this.parseOrExpression();
    this.expect("EOL");
    return { expression };
  }

  private parseOrExpression(): AqlExpression {
    let left = this.parseAndExpression();

    while (this.match("OR")) {
      const operator = AqlLogicalOperator.OR;
      this.validateLogicalOperator(operator, this.previous.position);
      const right = this.parseAndExpression();
      left = {
        type: "binary",
        left,
        operator,
        right,
      } as AqlBinaryExpression;
    }

    return left;
  }

  private parseAndExpression(): AqlExpression {
    let left = this.parseNotExpression();

    while (this.match("AND")) {
      const operator = AqlLogicalOperator.AND;
      this.validateLogicalOperator(operator, this.previous.position);
      const right = this.parseNotExpression();
      left = {
        type: "binary",
        left,
        operator,
        right,
      } as AqlBinaryExpression;
    }

    return left;
  }

  private parseNotExpression(): AqlExpression {
    if (this.match("NOT")) {
      const position = this.previous.position;
      this.validateLogicalOperator(AqlLogicalOperator.NOT, position);
      const expression = this.parseNotExpression();
      return {
        type: "not",
        expression,
      } as AqlNotExpression;
    }

    return this.parsePrimaryExpression();
  }

  private parsePrimaryExpression(): AqlExpression {
    /**
     * Parentheses
     */
    if (this.match("LPAREN")) {
      const position = this.previous.position;
      if (this.config.parentheses === false) {
        throw AqlErrors.forbiddenParentheses(position);
      }
      const expression = this.parseOrExpression();
      this.expect("RPAREN");
      return {
        type: "paren",
        expression,
      } as AqlParenExpression;
    }

    /**
     * Boolean value
     */
    if (this.match("BOOLEAN")) {
      const value = this.previous.value!.toLowerCase() === "true"; // BOOLEAN always has value
      return {
        type: "boolean",
        value,
      } as AqlBooleanExpression;
    }

    /**
     * Condition or array condition
     */
    const left = this.parseAccessor();

    /**
     * Array condition (IN)
     */
    if (this.match("IN")) {
      const position = this.previous.position;
      const operator = AqlOperation.IN;
      this.validateOperation(operator, position);
      const right = this.parseArray();
      return {
        type: "arrayCondition",
        left,
        operator,
        right,
      } as AqlArrayConditionExpression;
    }

    /**
     * Regular condition
     */
    const operator = this.parseOperation();
    const right = this.parseValue();
    return {
      type: "condition",
      left,
      operator,
      right,
    } as AqlConditionExpression;
  }

  private parseAccessor(): AqlAccessor {
    this.expect("IDENTIFIER");
    const identifier = this.previous.value!; // IDENTIFIER always has value
    const position = this.previous.position;

    /**
     * Validate identifier format (only Latin letters and underscores)
     */
    this.validateIdentifierFormat(identifier, position);

    /**
     * Validate field name (configuration-based)
     */
    this.validateIdentifier(identifier, position);

    /**
     * Access to array element or object property
     */
    if (this.match("LBRACKET")) {
      if (this.config.indexAccess === false) {
        throw AqlErrors.forbiddenBracketAccess(this.previous.position);
      }
      let param: { value: string | number; type: "string" | "number" } | undefined;

      if (this.match("STRING")) {
        const stringValue = this.previous.value!; // STRING always has value
        const unquoted = this.unquoteString(stringValue);
        param = { value: unquoted, type: "string" };
      } else if (this.match("NUMBER")) {
        const numberValue = this.previous.value!; // NUMBER always has value
        param = { value: parseFloat(numberValue), type: "number" };
      } else {
        throw AqlErrors.expectedAccessor(this.current.position);
      }

      this.expect("RBRACKET");
      return { identifier, param };
    }

    return { identifier };
  }

  private parseOperation(): AqlOperations {
    const position = this.current.position;
    let operation: AqlOperations | null = null;

    if (this.match("GT")) {
      operation = AqlOperation.GT;
    } else if (this.match("GE")) {
      operation = AqlOperation.GE;
    } else if (this.match("LT")) {
      operation = AqlOperation.LT;
    } else if (this.match("LE")) {
      operation = AqlOperation.LE;
    } else if (this.match("EQ")) {
      operation = AqlOperation.EQ;
    } else if (this.match("NEQ")) {
      operation = AqlOperation.NEQ;
    } else if (this.match("CONTAINS")) {
      operation = AqlOperation.CONTAINS;
    }

    if (operation) {
      this.validateOperation(operation, position);
      return operation;
    }

    throw AqlErrors.expectedOperation(position);
  }

  private parseValue(): AqlValue {
    const position = this.current.position;

    if (this.match("NULL")) {
      const valueType: AqlValueKind = "NULL";
      this.validateValueType(valueType, position);
      return { value: "null", type: valueType };
    }

    if (this.match("BOOLEAN")) {
      const value = this.previous.value!; // BOOLEAN always has value
      const valueType: AqlValueKind = "BOOLEAN";
      this.validateValueType(valueType, position);
      return { value, type: valueType };
    }

    if (this.match("NUMBER")) {
      const value = this.previous.value!; // NUMBER always has value
      const valueType: AqlValueKind = "NUMBER";
      this.validateValueType(valueType, position);
      return { value, type: valueType };
    }

    if (this.match("STRING")) {
      const value = this.previous.value!; // STRING always has value
      const unquoted = this.unquoteString(value);
      const valueType: AqlValueKind = "STRING";
      this.validateValueType(valueType, position);
      return { value: unquoted, type: valueType };
    }

    if (this.match("FUNCTION")) {
      const key = this.previous.value!; // FUNCTION always has value
      const valueType: AqlValueKind = "FUNCTION";
      this.validateValueType(valueType, position);

      if (!this.context || this.context.size === 0) {
        return { value: "null", type: "NULL" };
      }

      const contextValue = this.context.get(key);

      if (contextValue === null || contextValue === undefined) {
        return { value: "null", type: "NULL" };
      }

      if (typeof contextValue === "number") {
        return { value: String(contextValue), type: "NUMBER" };
      }

      if (typeof contextValue === "boolean") {
        return { value: String(contextValue), type: "BOOLEAN" };
      }

      return { value: String(contextValue), type: "STRING" };
    }

    throw AqlErrors.expectedValue(position);
  }

  private parseArray(): AqlValue[] {
    this.expect("LBRACKET");
    const values: AqlValue[] = [];

    if (!this.match("RBRACKET")) {
      do {
        values.push(this.parseValue());
      } while (this.match("COMMA"));

      this.expect("RBRACKET");
    }

    return values;
  }

  private match(type: AqlTokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: AqlTokenType): boolean {
    if (this.reachedEOL) {
      return type === "EOL";
    }
    return this.current.type === type;
  }

  private expect(type: AqlTokenType): void {
    if (!this.match(type)) {
      const current = this.current;
      const context = this.getErrorContext(current.position);
      throw AqlErrors.expectedToken(type, current.type, current.position, context ?? undefined);
    }
  }

  private getErrorContext(position: number): string | null {
    if (position < 0 || position >= this.tokens.length) {
      return null;
    }

    const start = Math.max(0, position - 2);
    const end = Math.min(this.tokens.length, position + 3);
    // Build context string directly without creating intermediate arrays
    const parts: string[] = [];
    for (let i = start; i < end; i++) {
      const token = this.tokens[i];
      parts.push(token.value ?? token.type);
    }
    return parts.join(" ");
  }

  private advance(): void {
    if (!this.reachedEOL) {
      this.position++;
    }
  }

  private get reachedEOL(): boolean {
    return this.current.type === "EOL";
  }

  private get current(): AqlToken {
    return this.tokens[this.position] || this.tokens[this.tokens.length - 1];
  }

  private get previous(): AqlToken {
    return this.tokens[this.position - 1];
  }

  private unquoteString(quoted: string): string {
    if (quoted.length < 2 || quoted[0] !== '"' || quoted[quoted.length - 1] !== '"') {
      return quoted;
    }

    // Optimize: process escape sequences in a single pass instead of multiple replace() calls
    const chars: string[] = [];
    for (let i = 1; i < quoted.length - 1; i++) {
      const char = quoted[i];
      if (char === "\\" && i + 1 < quoted.length - 1) {
        const next = quoted[i + 1];
        switch (next) {
          case "n":
            chars.push("\n");
            i++; // Skip next character as it's part of escape sequence
            continue;
          case "t":
            chars.push("\t");
            i++;
            continue;
          case "r":
            chars.push("\r");
            i++;
            continue;
          case '"':
            chars.push('"');
            i++;
            continue;
          case "\\":
            chars.push("\\");
            i++;
            continue;
          default:
            // Unknown escape sequence - add both backslash and next char as-is
            chars.push(char);
            chars.push(next);
            i++;
            continue;
        }
      } else {
        chars.push(char);
      }
    }
    return chars.join("");
  }

  /**
   * Validates that the identifier format is correct (only Latin letters and underscores).
   *
   * @param identifier - The identifier to validate
   * @param position - The position in the input string where the identifier was found
   * @throws {AqlParserError} If the identifier format is invalid
   * @private
   */
  private validateIdentifierFormat(identifier: string, position: number): void {
    /**
     * Check if identifier contains only Latin letters (a-z, A-Z) and underscores (_)
     */
    if (!/^[a-zA-Z_]+$/.test(identifier)) {
      throw AqlErrors.invalidIdentifier(identifier, position);
    }
  }

  /**
   * Validates that the logical operator is allowed according to the configuration.
   *
   * @param operator - The logical operator to validate (AND, OR, NOT)
   * @param position - The position in the input string where the operator was found
   * @throws {AqlParserError} If the operator is not allowed
   * @private
   */
  private validateLogicalOperator(operator: AqlLogicalOperators, position: number): void {
    if (this.config.logicalOperators === undefined) {
      return; // All operators allowed
    }
    if (!this.config.logicalOperators.includes(operator)) {
      throw AqlErrors.forbiddenLogicalOperator(operator, position);
    }
  }

  /**
   * Validates that the operation is allowed according to the configuration.
   *
   * @param operation - The operation to validate (GT, GE, LT, LE, EQ, NEQ, CONTAINS, IN)
   * @param position - The position in the input string where the operation was found
   * @throws {AqlParserError} If the operation is not allowed
   * @private
   */
  private validateOperation(operation: AqlOperations, position: number): void {
    if (this.config.operations === undefined) {
      return; // All operations allowed
    }
    if (!this.config.operations.includes(operation)) {
      throw AqlErrors.forbiddenOperation(operation, position);
    }
  }

  /**
   * Validates that the identifier is allowed according to the configuration.
   *
   * @param identifier - The identifier to validate
   * @param position - The position in the input string where the identifier was found
   * @throws {AqlParserError} If the identifier is not allowed
   * @private
   */
  private validateIdentifier(identifier: string, position: number): void {
    if (this.config.identifiers === undefined) {
      return; // All identifiers allowed
    }
    if (Array.isArray(this.config.identifiers)) {
      if (!this.config.identifiers.includes(identifier)) {
        throw AqlErrors.forbiddenIdentifier(identifier, position);
      }
    } else if (typeof this.config.identifiers === "function") {
      if (!this.config.identifiers(identifier)) {
        throw AqlErrors.forbiddenIdentifier(identifier, position);
      }
    }
  }

  /**
   * Validates that the value type is allowed according to the configuration.
   *
   * @param valueType - The value type to validate (NULL, BOOLEAN, NUMBER, STRING, FUNCTION)
   * @param position - The position in the input string where the value was found
   * @throws {AqlParserError} If the value type is not allowed
   * @private
   */
  private validateValueType(valueType: AqlValueKind, position: number): void {
    if (this.config.valueTypes === undefined) {
      return; // All value types allowed
    }
    if (!this.config.valueTypes.includes(valueType)) {
      throw AqlErrors.forbiddenValueType(valueType, position);
    }
  }
}

/**
 * Convenience function for parsing AQL string.
 *
 * @param aql - The AQL string to parse
 * @param context - Optional context map or object for function values (e.g., `now()`, `currentUser()`)
 * @param config - Optional parser configuration to restrict available features
 * @returns The parse result containing the expression or null if input is empty
 * @throws {AqlParserError} If the AQL string is invalid or uses forbidden features
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = parseAql('status = "passed"');
 *
 * // With context
 * const result = parseAql('createdDate >= now()', { "now()": Date.now() });
 *
 * // With configuration
 * import { AqlOperation } from "./types";
 * const config = { operations: [AqlOperation.EQ, AqlOperation.NEQ], identifiers: ["status"] };
 * const result = parseAql('status = "passed"', undefined, config);
 * ```
 */
export function parseAql(
  aql: string,
  context?: Map<string, any> | Record<string, any>,
  config?: AqlParserConfig,
): AqlParseResult {
  if (!aql || typeof aql !== "string") {
    return { expression: null };
  }

  let contextMap: Map<string, any> | undefined;

  if (context instanceof Map) {
    contextMap = context;
  } else if (context && typeof context === "object") {
    // Convert plain object to Map, but avoid creating Map for Map instances (handled above)
    contextMap = new Map(Object.entries(context));
  }

  const parser = new AqlParser(aql, contextMap, config);

  return parser.parse();
}
