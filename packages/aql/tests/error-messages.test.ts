import { describe, expect, test } from "vitest";
import { isAqlError, parseAql } from "../src/index.js";
import { AqlErrorCode } from "../src/errors/index.js";

/**
 * Error message quality tests - verify that error messages are helpful and informative
 * Tests check that errors include position, context, and clear descriptions
 */

describe("Error Message Quality Tests", () => {
  describe("Error message structure", () => {
    test("should include error code in error object", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.code).toBeDefined();
        expect(typeof error.code).toBe("string");
        expect(Object.values(AqlErrorCode)).toContain(error.code);
      }
    });

    test("should include error message", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe("string");
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    test("should include error details", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.details).toBeDefined();
        expect(typeof error.details).toBe("object");
      }
    });

    test("should include fullDetails with code", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.fullDetails).toBeDefined();
        expect(error.fullDetails.code).toBeDefined();
        expect(error.fullDetails.code).toBe(error.code);
      }
    });
  });

  describe("Position information", () => {
    test("should include position for unexpected character", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.details.position).toBeDefined();
        expect(typeof error.details.position).toBe("number");
        expect(error.details.position).toBeGreaterThanOrEqual(0);
      }
    });

    test("should include position for unterminated string", () => {
      try {
        parseAql('status = "unterminated');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.details.position).toBeDefined();
        expect(typeof error.details.position).toBe("number");
      }
    });

    test("should include position for expected token", () => {
      try {
        parseAql("status =");
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.details.position).toBeDefined();
        expect(typeof error.details.position).toBe("number");
      }
    });

    test("position should be accurate", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        // '@' is at position 7 (after "status ")
        expect(error.details.position).toBe(7);
      }
    });
  });

  describe("Context information", () => {
    test("should include context for expected token errors", () => {
      try {
        parseAql("status =");
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        if (error.code === AqlErrorCode.EXPECTED_TOKEN) {
          expect(error.details.context).toBeDefined();
          expect(typeof error.details.context).toBe("string");
        }
      }
    });

    test("context should include surrounding tokens", () => {
      try {
        parseAql("status =");
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        if (error.details.context) {
          expect(error.details.context).toContain("status");
        }
      }
    });
  });

  describe("Error message clarity", () => {
    test("unexpected character error should mention the character", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.code).toBe(AqlErrorCode.UNEXPECTED_CHARACTER);
        expect(error.message).toContain("@");
        expect(error.details.character).toBe("@");
      }
    });

    test("unterminated string error should be clear", () => {
      try {
        parseAql('status = "unterminated');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.code).toBe(AqlErrorCode.UNTERMINATED_STRING);
        expect(error.message.toLowerCase()).toMatch(/unterminated|string/i);
      }
    });

    test("expected token error should mention what was expected", () => {
      try {
        parseAql("status =");
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        if (error.code === AqlErrorCode.EXPECTED_TOKEN) {
          expect(error.details.expected).toBeDefined();
          expect(error.message.toLowerCase()).toMatch(/expected/i);
        }
      }
    });

    test("expected operation error should be clear", () => {
      try {
        parseAql("status");
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        if (error.code === AqlErrorCode.EXPECTED_OPERATION) {
          expect(error.message.toLowerCase()).toMatch(/expected|operation/i);
        }
      }
    });

    test("invalid identifier error should mention the identifier", () => {
      try {
        parseAql("123field = \"value\"");
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        // May be caught at tokenizer or parser level
        if (error.code === AqlErrorCode.INVALID_IDENTIFIER) {
          expect(error.details.identifier).toBeDefined();
        }
      }
    });
  });

  describe("Error message consistency", () => {
    test("same error type should have consistent structure", () => {
      const invalidInputs = [
        'status @ "passed"',
        'name # "test"',
        "age $ 25",
      ];

      invalidInputs.forEach((input) => {
        try {
          parseAql(input);
        } catch (error: any) {
          expect(isAqlError(error)).toBe(true);
          if (error.code === AqlErrorCode.UNEXPECTED_CHARACTER) {
            expect(error.details.character).toBeDefined();
            expect(error.details.position).toBeDefined();
          }
        }
      });
    });

    test("error messages should be user-friendly", () => {
      const testCases = [
        { input: 'status @ "passed"', shouldContain: ["character", "@"] },
        { input: 'status = "unterminated', shouldContain: ["string"] },
        { input: "status =", shouldContain: ["expected"] },
      ];

      testCases.forEach(({ input, shouldContain }) => {
        try {
          parseAql(input);
        } catch (error: any) {
          expect(isAqlError(error)).toBe(true);
          const message = error.message.toLowerCase();
          shouldContain.forEach((term) => {
            expect(message).toContain(term.toLowerCase());
          });
        }
      });
    });
  });

  describe("Translation support", () => {
    test("should have translation key", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        expect(error.translationKey).toBeDefined();
        expect(typeof error.translationKey).toBe("string");
        expect(error.translationKey).toMatch(/^aql\.errors\./);
      }
    });

    test("translation key should match error code", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        const expectedKey = `aql.errors.${error.code}`;
        expect(error.translationKey).toBe(expectedKey);
      }
    });

    test("fullDetails should include all information for translation", () => {
      try {
        parseAql('status @ "passed"');
      } catch (error: any) {
        expect(isAqlError(error)).toBe(true);
        const details = error.fullDetails;
        expect(details.code).toBeDefined();
        // Should include all context needed for translation
        expect(details).toBeDefined();
      }
    });
  });

  describe("Error message completeness", () => {
    test("should provide enough information to locate error", () => {
      const testCases = [
        { input: 'status @ "passed"', needs: ["position", "character"] },
        { input: 'status = "unterminated', needs: ["position"] },
        { input: "status =", needs: ["position", "expected"] },
      ];

      testCases.forEach(({ input, needs }) => {
        try {
          parseAql(input);
        } catch (error: any) {
          expect(isAqlError(error)).toBe(true);
          needs.forEach((need) => {
            if (need === "position") {
              expect(error.details.position).toBeDefined();
            } else if (need === "character") {
              // Only for unexpected character errors
              if (error.code === AqlErrorCode.UNEXPECTED_CHARACTER) {
                expect(error.details.character).toBeDefined();
              }
            } else if (need === "expected") {
              // Only for expected token errors
              if (error.code === AqlErrorCode.EXPECTED_TOKEN) {
                expect(error.details.expected).toBeDefined();
              }
            }
          });
        }
      });
    });
  });
});
