import { describe, expect, test } from "vitest";
import {
  AqlError,
  AqlErrorCode,
  AqlErrors,
  AqlParserError,
  AqlTokenizerError,
  isAqlError,
  isAqlParserError,
  isAqlTokenizerError,
} from "../src/errors/index.js";

describe("AqlError", () => {
  test("should create error with code and details", () => {
    const error = new AqlError(AqlErrorCode.UNEXPECTED_CHARACTER, "Test error", { position: 10, character: "@" });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AqlError);
    expect(error.code).toBe(AqlErrorCode.UNEXPECTED_CHARACTER);
    expect(error.details).toEqual({ position: 10, character: "@" });
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("AqlError");
  });

  test("should have fullDetails getter", () => {
    const error = new AqlError(AqlErrorCode.UNEXPECTED_CHARACTER, "Test error", {
      position: 10,
    });
    const details = error.fullDetails;

    expect(details).toEqual({
      code: AqlErrorCode.UNEXPECTED_CHARACTER,
      position: 10,
    });
  });

  test("should have translationKey getter", () => {
    const error = new AqlError(AqlErrorCode.UNEXPECTED_CHARACTER, "Test error");
    expect(error.translationKey).toBe("aql.errors.UNEXPECTED_CHARACTER");
  });
});

describe("AqlTokenizerError", () => {
  test("should create tokenizer error", () => {
    const error = new AqlTokenizerError(AqlErrorCode.UNEXPECTED_CHARACTER, "Unexpected character", { position: 5 });

    expect(error).toBeInstanceOf(AqlError);
    expect(error).toBeInstanceOf(AqlTokenizerError);
    expect(error.name).toBe("AqlTokenizerError");
    expect(error.code).toBe(AqlErrorCode.UNEXPECTED_CHARACTER);
  });
});

describe("AqlParserError", () => {
  test("should create parser error", () => {
    const error = new AqlParserError(AqlErrorCode.EXPECTED_TOKEN, "Expected token", { position: 10 });

    expect(error).toBeInstanceOf(AqlError);
    expect(error).toBeInstanceOf(AqlParserError);
    expect(error.name).toBe("AqlParserError");
    expect(error.code).toBe(AqlErrorCode.EXPECTED_TOKEN);
  });
});

describe("AqlErrors helper functions", () => {
  test("should create unexpectedCharacter error", () => {
    const error = AqlErrors.unexpectedCharacter("@", 10);

    expect(error).toBeInstanceOf(AqlTokenizerError);
    expect(error.code).toBe(AqlErrorCode.UNEXPECTED_CHARACTER);
    expect(error.details).toEqual({ character: "@", position: 10 });
  });

  test("should create unterminatedString error", () => {
    const error = AqlErrors.unterminatedString(5);

    expect(error).toBeInstanceOf(AqlTokenizerError);
    expect(error.code).toBe(AqlErrorCode.UNTERMINATED_STRING);
    expect(error.details).toEqual({ position: 5 });
  });

  test("should create invalidUnicodeEscape error", () => {
    const error = AqlErrors.invalidUnicodeEscape(10);

    expect(error).toBeInstanceOf(AqlTokenizerError);
    expect(error.code).toBe(AqlErrorCode.INVALID_UNICODE_ESCAPE);
    expect(error.details).toEqual({ position: 10 });
  });

  test("should create expectedToken error", () => {
    const error = AqlErrors.expectedToken("IDENTIFIER", "EOL", 10, "status =");

    expect(error).toBeInstanceOf(AqlParserError);
    expect(error.code).toBe(AqlErrorCode.EXPECTED_TOKEN);
    expect(error.details).toEqual({
      expected: "IDENTIFIER",
      got: "EOL",
      position: 10,
      context: "status =",
    });
  });

  test("should create expectedToken error without context", () => {
    const error = AqlErrors.expectedToken("IDENTIFIER", "EOL", 10);

    expect(error).toBeInstanceOf(AqlParserError);
    expect(error.details.context).toBeUndefined();
  });

  test("should create expectedOperation error", () => {
    const error = AqlErrors.expectedOperation(5);

    expect(error).toBeInstanceOf(AqlParserError);
    expect(error.code).toBe(AqlErrorCode.EXPECTED_OPERATION);
    expect(error.details).toEqual({ position: 5 });
  });

  test("should create expectedValue error", () => {
    const error = AqlErrors.expectedValue(8);

    expect(error).toBeInstanceOf(AqlParserError);
    expect(error.code).toBe(AqlErrorCode.EXPECTED_VALUE);
    expect(error.details).toEqual({ position: 8 });
  });

  test("should create expectedAccessor error", () => {
    const error = AqlErrors.expectedAccessor(12);

    expect(error).toBeInstanceOf(AqlParserError);
    expect(error.code).toBe(AqlErrorCode.EXPECTED_ACCESSOR);
    expect(error.details).toEqual({ position: 12 });
  });

  test("should create expectedAccessor error with expected type", () => {
    const error = AqlErrors.expectedAccessor(12, "STRING");

    expect(error).toBeInstanceOf(AqlParserError);
    expect(error.details).toEqual({ position: 12, expected: "STRING" });
  });

  test("should create invalidInput error", () => {
    const error = AqlErrors.invalidInput("Input must be a non-empty string");

    expect(error).toBeInstanceOf(AqlParserError);
    expect(error.code).toBe(AqlErrorCode.INVALID_INPUT);
    expect(error.details).toEqual({ reason: "Input must be a non-empty string" });
  });
});

describe("Type guards", () => {
  test("isAqlError should return true for AqlError", () => {
    const error = new AqlError(AqlErrorCode.UNEXPECTED_CHARACTER, "Test");
    expect(isAqlError(error)).toBe(true);
  });

  test("isAqlError should return true for AqlTokenizerError", () => {
    const error = new AqlTokenizerError(AqlErrorCode.UNEXPECTED_CHARACTER, "Test");
    expect(isAqlError(error)).toBe(true);
  });

  test("isAqlError should return true for AqlParserError", () => {
    const error = new AqlParserError(AqlErrorCode.EXPECTED_TOKEN, "Test");
    expect(isAqlError(error)).toBe(true);
  });

  test("isAqlError should return false for regular Error", () => {
    const error = new Error("Test");
    expect(isAqlError(error)).toBe(false);
  });

  test("isAqlTokenizerError should return true for AqlTokenizerError", () => {
    const error = new AqlTokenizerError(AqlErrorCode.UNEXPECTED_CHARACTER, "Test");
    expect(isAqlTokenizerError(error)).toBe(true);
  });

  test("isAqlTokenizerError should return false for AqlParserError", () => {
    const error = new AqlParserError(AqlErrorCode.EXPECTED_TOKEN, "Test");
    expect(isAqlTokenizerError(error)).toBe(false);
  });

  test("isAqlParserError should return true for AqlParserError", () => {
    const error = new AqlParserError(AqlErrorCode.EXPECTED_TOKEN, "Test");
    expect(isAqlParserError(error)).toBe(true);
  });

  test("isAqlParserError should return false for AqlTokenizerError", () => {
    const error = new AqlTokenizerError(AqlErrorCode.UNEXPECTED_CHARACTER, "Test");
    expect(isAqlParserError(error)).toBe(false);
  });
});
