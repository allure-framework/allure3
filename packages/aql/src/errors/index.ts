/* eslint-disable max-len */
/**
 * AQL error types and classes
 */

/**
 * Extend ErrorConstructor to include captureStackTrace (V8/Node.js specific)
 */
declare global {
  interface ErrorConstructor {
    // eslint-disable-next-line @typescript-eslint/no-restricted-types, @typescript-eslint/no-unsafe-function-type
    captureStackTrace?(error: Error, constructorOpt?: Function): void;
  }
}

export enum AqlErrorCode {
  /** Tokenizer errors */
  UNEXPECTED_CHARACTER = "UNEXPECTED_CHARACTER",
  UNTERMINATED_STRING = "UNTERMINATED_STRING",
  INVALID_UNICODE_ESCAPE = "INVALID_UNICODE_ESCAPE",

  /** Parser errors */
  EXPECTED_TOKEN = "EXPECTED_TOKEN",
  EXPECTED_OPERATION = "EXPECTED_OPERATION",
  EXPECTED_VALUE = "EXPECTED_VALUE",
  EXPECTED_ACCESSOR = "EXPECTED_ACCESSOR",
  INVALID_SYNTAX = "INVALID_SYNTAX",
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_IDENTIFIER = "INVALID_IDENTIFIER",

  /** Configuration errors */
  FORBIDDEN_LOGICAL_OPERATOR = "FORBIDDEN_LOGICAL_OPERATOR",
  FORBIDDEN_OPERATION = "FORBIDDEN_OPERATION",
  FORBIDDEN_ARRAY_OPERATION = "FORBIDDEN_ARRAY_OPERATION",
  FORBIDDEN_IDENTIFIER = "FORBIDDEN_IDENTIFIER",
  FORBIDDEN_VALUE_TYPE = "FORBIDDEN_VALUE_TYPE",
  FORBIDDEN_PARENTHESES = "FORBIDDEN_PARENTHESES",
  FORBIDDEN_BRACKET_ACCESS = "FORBIDDEN_BRACKET_ACCESS",
}

export interface AqlErrorDetails {
  position?: number;
  expected?: string;
  got?: string;
  context?: string;
  character?: string;
  [key: string]: any;
}

/**
 * Base error class for AQL errors
 */
export class AqlError extends Error {
  public readonly code: AqlErrorCode;
  public readonly details: AqlErrorDetails;

  constructor(code: AqlErrorCode, message: string, details: AqlErrorDetails = {}) {
    super(message);
    this.name = "AqlError";
    this.code = code;
    this.details = details;

    /**
     * Maintains proper stack trace for where our error was thrown (only available on V8)
     */
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Gets error details for translation/localization
   * Includes error code and all context information
   */
  get fullDetails(): AqlErrorDetails & { code: AqlErrorCode } {
    return { ...this.details, code: this.code };
  }

  /**
   * Gets error code for translation key generation
   */
  get translationKey(): string {
    return `aql.errors.${this.code}`;
  }
}

/**
 * Tokenizer error
 */
export class AqlTokenizerError extends AqlError {
  constructor(code: AqlErrorCode, message: string, details: AqlErrorDetails = {}) {
    super(code, message, details);
    this.name = "AqlTokenizerError";
  }
}

/**
 * Parser error
 */
export class AqlParserError extends AqlError {
  constructor(code: AqlErrorCode, message: string, details: AqlErrorDetails = {}) {
    super(code, message, details);
    this.name = "AqlParserError";
  }
}

/**
 * Helper functions to create specific errors
 */
export const AqlErrors = {
  unexpectedCharacter: (character: string, position: number): AqlTokenizerError => {
    return new AqlTokenizerError(
      AqlErrorCode.UNEXPECTED_CHARACTER,
      `Unexpected character: ${character} at position ${position}`,
      { character, position },
    );
  },

  unterminatedString: (position: number): AqlTokenizerError => {
    return new AqlTokenizerError(AqlErrorCode.UNTERMINATED_STRING, `Unterminated string at position ${position}`, {
      position,
    });
  },

  invalidUnicodeEscape: (position: number): AqlTokenizerError => {
    return new AqlTokenizerError(
      AqlErrorCode.INVALID_UNICODE_ESCAPE,
      `Invalid Unicode escape sequence at position ${position}`,
      { position },
    );
  },

  expectedToken: (expected: string, got: string, position: number, context?: string): AqlParserError => {
    const message = context
      ? `Expected ${expected}, got ${got} at position ${position}. Context: ${context}`
      : `Expected ${expected}, got ${got} at position ${position}`;
    return new AqlParserError(AqlErrorCode.EXPECTED_TOKEN, message, {
      expected,
      got,
      position,
      context,
    });
  },

  expectedOperation: (position: number): AqlParserError => {
    return new AqlParserError(AqlErrorCode.EXPECTED_OPERATION, `Expected operation at position ${position}`, {
      position,
    });
  },

  expectedValue: (position: number): AqlParserError => {
    return new AqlParserError(AqlErrorCode.EXPECTED_VALUE, `Expected value at position ${position}`, { position });
  },

  expectedAccessor: (position: number, expected?: string): AqlParserError => {
    const message = expected
      ? `Expected ${expected} in accessor at position ${position}`
      : `Expected STRING or NUMBER in accessor at position ${position}`;
    return new AqlParserError(AqlErrorCode.EXPECTED_ACCESSOR, message, {
      position,
      expected,
    });
  },

  invalidInput: (reason: string): AqlParserError => {
    return new AqlParserError(AqlErrorCode.INVALID_INPUT, reason, { reason });
  },

  invalidIdentifier: (identifier: string, position: number): AqlParserError => {
    return new AqlParserError(
      AqlErrorCode.INVALID_IDENTIFIER,
      `Invalid identifier '${identifier}' at position ${position}. Identifier must contain only Latin letters (a-z, A-Z) and underscores (_)`,
      { identifier, position },
    );
  },

  forbiddenLogicalOperator: (operator: string, position: number): AqlParserError => {
    return new AqlParserError(
      AqlErrorCode.FORBIDDEN_LOGICAL_OPERATOR,
      `Logical operator '${operator}' is not allowed at position ${position}`,
      { operator, position },
    );
  },

  forbiddenOperation: (operation: string, position: number): AqlParserError => {
    return new AqlParserError(
      AqlErrorCode.FORBIDDEN_OPERATION,
      `Operation '${operation}' is not allowed at position ${position}`,
      { operation, position },
    );
  },

  forbiddenArrayOperation: (operation: string, position: number): AqlParserError => {
    return new AqlParserError(
      AqlErrorCode.FORBIDDEN_ARRAY_OPERATION,
      `Array operation '${operation}' is not allowed at position ${position}`,
      { operation, position },
    );
  },

  forbiddenIdentifier: (identifier: string, position: number): AqlParserError => {
    return new AqlParserError(
      AqlErrorCode.FORBIDDEN_IDENTIFIER,
      `Identifier '${identifier}' is not allowed at position ${position}`,
      { identifier, position },
    );
  },

  forbiddenValueType: (valueType: string, position: number): AqlParserError => {
    return new AqlParserError(
      AqlErrorCode.FORBIDDEN_VALUE_TYPE,
      `Value type '${valueType}' is not allowed at position ${position}`,
      { valueType, position },
    );
  },

  forbiddenParentheses: (position: number): AqlParserError => {
    return new AqlParserError(
      AqlErrorCode.FORBIDDEN_PARENTHESES,
      `Parentheses are not allowed at position ${position}`,
      { position },
    );
  },

  forbiddenBracketAccess: (position: number): AqlParserError => {
    return new AqlParserError(
      AqlErrorCode.FORBIDDEN_BRACKET_ACCESS,
      `Bracket access is not allowed at position ${position}`,
      { position },
    );
  },
};

/**
 * Type guard to check if error is AqlError
 */
export function isAqlError(error: unknown): error is AqlError {
  return error instanceof AqlError;
}

/**
 * Type guard to check if error is AqlTokenizerError
 */
export function isAqlTokenizerError(error: unknown): error is AqlTokenizerError {
  return error instanceof AqlTokenizerError;
}

/**
 * Type guard to check if error is AqlParserError
 */
export function isAqlParserError(error: unknown): error is AqlParserError {
  return error instanceof AqlParserError;
}
