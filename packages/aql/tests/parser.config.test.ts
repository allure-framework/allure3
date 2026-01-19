import { describe, expect, test } from "vitest";
import { AqlErrorCode, isAqlParserError } from "../src/errors/index.js";
import type { AqlParserConfig } from "../src/model.js";
import { AqlLogicalOperator, AqlOperation } from "../src/model.js";
import { parseAql } from "../src/parser/index.js";

describe("AqlParser Configuration", () => {
  describe("logicalOperators", () => {
    test("should allow only specified logical operators", () => {
      const config: AqlParserConfig = {
        logicalOperators: [AqlLogicalOperator.AND],
      };

      // AND should work
      expect(() => parseAql('status = "passed" AND name = "test"', undefined, config)).not.toThrow();

      // OR should be forbidden
      expect(() => {
        parseAql('status = "passed" OR name = "test"', undefined, config);
      }).toThrow();

      const error = (() => {
        try {
          parseAql('status = "passed" OR name = "test"', undefined, config);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).not.toBeNull();
      if (error && isAqlParserError(error)) {
        expect(error.code).toBe(AqlErrorCode.FORBIDDEN_LOGICAL_OPERATOR);
        expect(error.details.operator).toBe("OR");
      }
    });

    test("should allow OR but not AND", () => {
      const config: AqlParserConfig = {
        logicalOperators: [AqlLogicalOperator.OR],
      };

      expect(() => parseAql('status = "passed" OR name = "test"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('status = "passed" AND name = "test"', undefined, config);
      }).toThrow();
    });

    test("should allow NOT operator", () => {
      const config: AqlParserConfig = {
        logicalOperators: [AqlLogicalOperator.NOT],
      };

      expect(() => parseAql('NOT status = "passed"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('status = "passed" AND name = "test"', undefined, config);
      }).toThrow();
    });

    test("should allow multiple logical operators", () => {
      const config: AqlParserConfig = {
        logicalOperators: [AqlLogicalOperator.AND, AqlLogicalOperator.OR],
      };

      expect(() => parseAql('status = "passed" AND name = "test"', undefined, config)).not.toThrow();
      expect(() => parseAql('status = "passed" OR name = "test"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('NOT status = "passed"', undefined, config);
      }).toThrow();
    });

    test("should allow all operators when not specified", () => {
      const config: AqlParserConfig = {};

      expect(() => parseAql('status = "passed" AND name = "test"', undefined, config)).not.toThrow();
      expect(() => parseAql('status = "passed" OR name = "test"', undefined, config)).not.toThrow();
      expect(() => parseAql('NOT status = "passed"', undefined, config)).not.toThrow();
    });
  });

  describe("operations", () => {
    test("should allow only specified operations", () => {
      const config: AqlParserConfig = {
        operations: [AqlOperation.EQ, AqlOperation.NEQ],
      };

      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('status != "passed"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('status > "passed"', undefined, config);
      }).toThrow();

      const error = (() => {
        try {
          parseAql('status > "passed"', undefined, config);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).not.toBeNull();
      if (error && isAqlParserError(error)) {
        expect(error.code).toBe(AqlErrorCode.FORBIDDEN_OPERATION);
        expect(error.details.operation).toBe("GT");
      }
    });

    test("should allow all comparison operations when not specified", () => {
      const config: AqlParserConfig = {};

      expect(() => parseAql('status > "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('status >= "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('status < "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('status <= "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('status != "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('status ~= "passed"', undefined, config)).not.toThrow();
    });

    test("should allow CONTAINS operation", () => {
      const config: AqlParserConfig = {
        operations: [AqlOperation.CONTAINS],
      };

      expect(() => parseAql('status ~= "passed"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('status = "passed"', undefined, config);
      }).toThrow();
    });
  });

  describe("operations with IN", () => {
    test("should allow IN operation when specified", () => {
      const config: AqlParserConfig = {
        operations: [AqlOperation.IN],
      };

      expect(() => parseAql('status IN ["passed", "failed"]', undefined, config)).not.toThrow();
    });

    test("should forbid IN operation when not allowed", () => {
      const config: AqlParserConfig = {
        operations: [AqlOperation.EQ, AqlOperation.NEQ],
      };

      expect(() => {
        parseAql('status IN ["passed", "failed"]', undefined, config);
      }).toThrow();

      const error = (() => {
        try {
          parseAql('status IN ["passed", "failed"]', undefined, config);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).not.toBeNull();
      if (error && isAqlParserError(error)) {
        expect(error.code).toBe(AqlErrorCode.FORBIDDEN_OPERATION);
        expect(error.details.operation).toBe("IN");
      }
    });

    test("should allow IN when not specified", () => {
      const config: AqlParserConfig = {};

      expect(() => parseAql('status IN ["passed", "failed"]', undefined, config)).not.toThrow();
    });
  });

  describe("identifiers", () => {
    test("should allow only specified identifiers (array)", () => {
      const config: AqlParserConfig = {
        identifiers: ["status", "name"],
      };

      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('name = "test"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('description = "test"', undefined, config);
      }).toThrow();

      const error = (() => {
        try {
          parseAql('description = "test"', undefined, config);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).not.toBeNull();
      if (error && isAqlParserError(error)) {
        expect(error.code).toBe(AqlErrorCode.FORBIDDEN_IDENTIFIER);
        expect(error.details.identifier).toBe("description");
      }
    });

    test("should allow identifiers via validation function", () => {
      const config: AqlParserConfig = {
        identifiers: (identifier) => identifier === "status" || identifier === "name",
      };

      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('name = "test"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('description = "test"', undefined, config);
      }).toThrow();

      const error = (() => {
        try {
          parseAql('description = "test"', undefined, config);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).not.toBeNull();
      if (error && isAqlParserError(error)) {
        expect(error.code).toBe(AqlErrorCode.FORBIDDEN_IDENTIFIER);
        expect(error.details.identifier).toBe("description");
      }
    });

    test("should allow identifiers via validation function with pattern", () => {
      const config: AqlParserConfig = {
        identifiers: (identifier) => identifier.startsWith("allowed_"),
      };

      expect(() => parseAql('allowed_status = "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('allowed_name = "test"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('forbidden_identifier = "test"', undefined, config);
      }).toThrow();

      const error = (() => {
        try {
          parseAql('forbidden_identifier = "test"', undefined, config);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).not.toBeNull();
      if (error && isAqlParserError(error)) {
        expect(error.code).toBe(AqlErrorCode.FORBIDDEN_IDENTIFIER);
        expect(error.details.identifier).toBe("forbidden_identifier");
      }
    });

    test("should allow all identifiers when not specified", () => {
      const config: AqlParserConfig = {};

      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('name = "test"', undefined, config)).not.toThrow();
      expect(() => parseAql('anyIdentifier = "value"', undefined, config)).not.toThrow();
    });

    test("should validate identifiers in complex expressions (array)", () => {
      const config: AqlParserConfig = {
        identifiers: ["status", "name"],
      };

      expect(() => {
        parseAql('status = "passed" AND name = "test"', undefined, config);
      }).not.toThrow();

      expect(() => {
        parseAql('status = "passed" AND description = "test"', undefined, config);
      }).toThrow();
    });

    test("should validate identifiers in complex expressions (function)", () => {
      const config: AqlParserConfig = {
        identifiers: (identifier) => identifier === "status" || identifier === "name",
      };

      expect(() => {
        parseAql('status = "passed" AND name = "test"', undefined, config);
      }).not.toThrow();

      expect(() => {
        parseAql('status = "passed" AND description = "test"', undefined, config);
      }).toThrow();
    });
  });

  describe("valueTypes", () => {
    test("should allow only specified value types", () => {
      const config: AqlParserConfig = {
        valueTypes: ["STRING", "NUMBER"],
      };

      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql("count = 10", undefined, config)).not.toThrow();

      expect(() => {
        parseAql("status = null", undefined, config);
      }).toThrow();

      const error = (() => {
        try {
          parseAql("status = null", undefined, config);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).not.toBeNull();
      if (error && isAqlParserError(error)) {
        expect(error.code).toBe(AqlErrorCode.FORBIDDEN_VALUE_TYPE);
        expect(error.details.valueType).toBe("NULL");
      }
    });

    test("should allow BOOLEAN values", () => {
      const config: AqlParserConfig = {
        valueTypes: ["BOOLEAN"],
      };

      expect(() => parseAql("isActive = true", undefined, config)).not.toThrow();
      expect(() => parseAql("isActive = false", undefined, config)).not.toThrow();

      expect(() => {
        parseAql('status = "passed"', undefined, config);
      }).toThrow();
    });

    test("should allow FUNCTION values", () => {
      const config: AqlParserConfig = {
        valueTypes: ["FUNCTION"],
      };

      const context = { "now()": Date.now() };
      expect(() => parseAql("createdDate >= now()", context, config)).not.toThrow();

      expect(() => {
        parseAql('status = "passed"', undefined, config);
      }).toThrow();
    });

    test("should allow all value types when not specified", () => {
      const config: AqlParserConfig = {};

      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql("count = 10", undefined, config)).not.toThrow();
      expect(() => parseAql("isActive = true", undefined, config)).not.toThrow();
      expect(() => parseAql("status = null", undefined, config)).not.toThrow();
    });
  });

  describe("parentheses", () => {
    test("should forbid parentheses when disabled", () => {
      const config: AqlParserConfig = {
        parentheses: false,
      };

      expect(() => {
        parseAql('(status = "passed")', undefined, config);
      }).toThrow();

      const error = (() => {
        try {
          parseAql('(status = "passed")', undefined, config);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).not.toBeNull();
      if (error && isAqlParserError(error)) {
        expect(error.code).toBe(AqlErrorCode.FORBIDDEN_PARENTHESES);
      }
    });

    test("should allow parentheses when enabled", () => {
      const config: AqlParserConfig = {
        parentheses: true,
      };

      expect(() => parseAql('(status = "passed")', undefined, config)).not.toThrow();
      expect(() => parseAql('(status = "passed" AND name = "test")', undefined, config)).not.toThrow();
    });

    test("should allow parentheses by default", () => {
      const config: AqlParserConfig = {};

      expect(() => parseAql('(status = "passed")', undefined, config)).not.toThrow();
    });
  });

  describe("indexAccess", () => {
    test("should forbid index access when disabled", () => {
      const config: AqlParserConfig = {
        indexAccess: false,
      };

      expect(() => {
        parseAql('items[0] = "test"', undefined, config);
      }).toThrow();

      const error = (() => {
        try {
          parseAql('items[0] = "test"', undefined, config);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).not.toBeNull();
      if (error && isAqlParserError(error)) {
        expect(error.code).toBe(AqlErrorCode.FORBIDDEN_BRACKET_ACCESS);
      }
    });

    test("should allow index access when enabled", () => {
      const config: AqlParserConfig = {
        indexAccess: true,
      };

      expect(() => parseAql('items[0] = "test"', undefined, config)).not.toThrow();
      expect(() => parseAql('metadata["key"] = "value"', undefined, config)).not.toThrow();
    });

    test("should allow bracket access by default", () => {
      const config: AqlParserConfig = {};

      expect(() => parseAql('items[0] = "test"', undefined, config)).not.toThrow();
    });
  });

  describe("combined configurations", () => {
    test("should work with multiple restrictions", () => {
      const config: AqlParserConfig = {
        operations: [AqlOperation.EQ, AqlOperation.NEQ],
        identifiers: ["status", "name"],
        logicalOperators: [AqlLogicalOperator.AND],
        parentheses: false,
        indexAccess: false,
      };

      expect(() => {
        parseAql('status = "passed" AND name != "test"', undefined, config);
      }).not.toThrow();

      expect(() => {
        parseAql('status > "passed"', undefined, config);
      }).toThrow();

      expect(() => {
        parseAql('description = "test"', undefined, config);
      }).toThrow();

      expect(() => {
        parseAql('status = "passed" OR name = "test"', undefined, config);
      }).toThrow();

      expect(() => {
        parseAql('(status = "passed")', undefined, config);
      }).toThrow();

      expect(() => {
        parseAql('items[0] = "test"', undefined, config);
      }).toThrow();
    });

    test("should work with minimal configuration (array)", () => {
      const config: AqlParserConfig = {
        operations: [AqlOperation.EQ],
        identifiers: ["status"],
      };

      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('status != "passed"', undefined, config);
      }).toThrow();

      expect(() => {
        parseAql('name = "test"', undefined, config);
      }).toThrow();
    });

    test("should work with minimal configuration (function)", () => {
      const config: AqlParserConfig = {
        operations: [AqlOperation.EQ],
        identifiers: (identifier) => identifier === "status",
      };

      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();

      expect(() => {
        parseAql('status != "passed"', undefined, config);
      }).toThrow();

      expect(() => {
        parseAql('name = "test"', undefined, config);
      }).toThrow();
    });

    test("should work with function-based identifier validation", () => {
      const config: AqlParserConfig = {
        identifiers: (identifier) => identifier.length <= 5,
        operations: [AqlOperation.EQ],
      };

      expect(() => parseAql('name = "test"', undefined, config)).not.toThrow();
      expect(() => parseAql("id = 1", undefined, config)).not.toThrow();

      expect(() => {
        parseAql('veryLongIdentifier = "test"', undefined, config);
      }).toThrow();
    });
  });

  describe("backward compatibility", () => {
    test("should work without config (backward compatible)", () => {
      // Without configuration, everything should work as before
      expect(() => parseAql('status = "passed"')).not.toThrow();
      expect(() => parseAql('status > "passed"')).not.toThrow();
      expect(() => parseAql('status = "passed" AND name = "test"')).not.toThrow();
      expect(() => parseAql('status = "passed" OR name = "test"')).not.toThrow();
      expect(() => parseAql('NOT status = "passed"')).not.toThrow();
      expect(() => parseAql('(status = "passed")')).not.toThrow();
      expect(() => parseAql('items[0] = "test"')).not.toThrow();
      expect(() => parseAql('status IN ["passed", "failed"]')).not.toThrow();
    });

    test("should work with empty config object", () => {
      const config: AqlParserConfig = {};

      expect(() => parseAql('status = "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('status > "passed"', undefined, config)).not.toThrow();
      expect(() => parseAql('status = "passed" AND name = "test"', undefined, config)).not.toThrow();
    });
  });
});
