import { describe, expect, test } from "vitest";
import { AqlTokenizer } from "../src/tokenizer/index.js";

describe("AqlTokenizer", () => {
  test("should tokenize simple identifier", () => {
    const tokenizer = new AqlTokenizer("status");
    const tokens = tokenizer.tokenize();

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ type: "IDENTIFIER", value: "status" });
    expect(tokens[1]).toMatchObject({ type: "EOL" });
  });

  test("should tokenize operators", () => {
    const tokenizer = new AqlTokenizer(">= <= != ~= > < =");
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "GE" });
    expect(tokens[1]).toMatchObject({ type: "LE" });
    expect(tokens[2]).toMatchObject({ type: "NEQ" });
    expect(tokens[3]).toMatchObject({ type: "CONTAINS" });
    expect(tokens[4]).toMatchObject({ type: "GT" });
    expect(tokens[5]).toMatchObject({ type: "LT" });
    expect(tokens[6]).toMatchObject({ type: "EQ" });
  });

  test("should tokenize keywords", () => {
    const tokenizer = new AqlTokenizer("AND OR NOT IN is");
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "AND" });
    expect(tokens[1]).toMatchObject({ type: "OR" });
    expect(tokens[2]).toMatchObject({ type: "NOT" });
    expect(tokens[3]).toMatchObject({ type: "IN" });
    expect(tokens[4]).toMatchObject({ type: "EQ" });
  });

  test("should tokenize keywords case-insensitive", () => {
    const tokenizer = new AqlTokenizer("and or not in");
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "AND" });
    expect(tokens[1]).toMatchObject({ type: "OR" });
    expect(tokens[2]).toMatchObject({ type: "NOT" });
    expect(tokens[3]).toMatchObject({ type: "IN" });
  });

  test("should tokenize strings", () => {
    const tokenizer = new AqlTokenizer('"test string"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"test string"' });
  });

  test("should tokenize strings with escape sequences", () => {
    const tokenizer = new AqlTokenizer('"test\\"quote\\nnewline"');
    const tokens = tokenizer.tokenize();

    // Tokenizer preserves the original string with quotes, escape sequences are processed during parsing
    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"test"quote\nnewline"' });
  });

  test("should tokenize strings with Unicode escape sequences", () => {
    const tokenizer = new AqlTokenizer('"test\\u0041\\u0430"');
    const tokens = tokenizer.tokenize();

    // \u0041 is 'A', \u0430 is 'а' (Cyrillic)
    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"testAа"' });
  });

  test("should tokenize strings with Chinese characters", () => {
    const tokenizer = new AqlTokenizer('"测试中文"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"测试中文"' });
  });

  test("should tokenize strings with Japanese characters", () => {
    const tokenizer = new AqlTokenizer('"テスト日本語"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"テスト日本語"' });
  });

  test("should tokenize strings with Korean characters", () => {
    const tokenizer = new AqlTokenizer('"테스트 한국어"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"테스트 한국어"' });
  });

  test("should handle brackets and parentheses inside strings", () => {
    const tokenizer = new AqlTokenizer('"test (with) [brackets]"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"test (with) [brackets]"' });
  });

  test("should handle nested brackets inside strings", () => {
    const tokenizer = new AqlTokenizer('"nested [brackets [inside] brackets]"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"nested [brackets [inside] brackets]"' });
  });

  test("should handle parentheses and brackets together in strings", () => {
    const tokenizer = new AqlTokenizer('"mixed (parens) and [brackets]"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"mixed (parens) and [brackets]"' });
  });

  test("should correctly distinguish brackets inside strings from actual bracket tokens", () => {
    const tokenizer = new AqlTokenizer('name["key"] = "value [with] brackets"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "IDENTIFIER", value: "name" });
    expect(tokens[1]).toMatchObject({ type: "LBRACKET" });
    expect(tokens[2]).toMatchObject({ type: "STRING", value: '"key"' });
    expect(tokens[3]).toMatchObject({ type: "RBRACKET" });
    expect(tokens[4]).toMatchObject({ type: "EQ" });
    expect(tokens[5]).toMatchObject({ type: "STRING", value: '"value [with] brackets"' });
  });

  test("should handle operators inside strings", () => {
    const tokenizer = new AqlTokenizer('"test >= <= != operators"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"test >= <= != operators"' });
  });

  test("should handle escaped quotes and brackets in strings", () => {
    const tokenizer = new AqlTokenizer('"test \\"quote\\" and [brackets]"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "STRING", value: '"test "quote" and [brackets]"' });
  });

  test("should not allow Chinese characters in identifiers", () => {
    const tokenizer = new AqlTokenizer('测试 = "value"');

    expect(() => tokenizer.tokenize()).toThrow("Unexpected character");
  });

  test("should allow Chinese characters only in string values", () => {
    const tokenizer = new AqlTokenizer('name = "测试"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "IDENTIFIER", value: "name" });
    expect(tokens[2]).toMatchObject({ type: "STRING", value: '"测试"' });
  });

  test("should tokenize numbers", () => {
    const tokenizer = new AqlTokenizer("123 45.67 -10 -3.14");
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "NUMBER", value: "123" });
    expect(tokens[1]).toMatchObject({ type: "NUMBER", value: "45.67" });
    expect(tokens[2]).toMatchObject({ type: "NUMBER", value: "-10" });
    expect(tokens[3]).toMatchObject({ type: "NUMBER", value: "-3.14" });
  });

  test("should tokenize booleans", () => {
    const tokenizer = new AqlTokenizer("true false TRUE FALSE");
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "BOOLEAN", value: "true" });
    expect(tokens[1]).toMatchObject({ type: "BOOLEAN", value: "false" });
    expect(tokens[2]).toMatchObject({ type: "BOOLEAN", value: "TRUE" });
    expect(tokens[3]).toMatchObject({ type: "BOOLEAN", value: "FALSE" });
  });

  test("should tokenize null keywords", () => {
    const tokenizer = new AqlTokenizer("null empty NULL EMPTY");
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "NULL" });
    expect(tokens[1]).toMatchObject({ type: "NULL" });
    expect(tokens[2]).toMatchObject({ type: "NULL" });
    expect(tokens[3]).toMatchObject({ type: "NULL" });
  });

  test("should tokenize brackets", () => {
    const tokenizer = new AqlTokenizer("()[],");
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "LPAREN" });
    expect(tokens[1]).toMatchObject({ type: "RPAREN" });
    expect(tokens[2]).toMatchObject({ type: "LBRACKET" });
    expect(tokens[3]).toMatchObject({ type: "RBRACKET" });
    expect(tokens[4]).toMatchObject({ type: "COMMA" });
  });

  test("should tokenize functions", () => {
    const tokenizer = new AqlTokenizer("now() currentUser()");
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "FUNCTION", value: "now()" });
    expect(tokens[1]).toMatchObject({ type: "FUNCTION", value: "currentUser()" });
  });

  test("should skip whitespace", () => {
    const tokenizer = new AqlTokenizer('  status   =   "test"  ');
    const tokens = tokenizer.tokenize();

    expect(tokens).toHaveLength(4);
    expect(tokens[0]).toMatchObject({ type: "IDENTIFIER", value: "status" });
    expect(tokens[1]).toMatchObject({ type: "EQ" });
    expect(tokens[2]).toMatchObject({ type: "STRING", value: '"test"' });
    expect(tokens[3]).toMatchObject({ type: "EOL" });
  });

  test("should throw error on unterminated string", () => {
    const tokenizer = new AqlTokenizer('"unterminated string');
    expect(() => tokenizer.tokenize()).toThrow("Unterminated string");
  });

  test("should throw error on unexpected character", () => {
    const tokenizer = new AqlTokenizer("@invalid");
    expect(() => tokenizer.tokenize()).toThrow("Unexpected character");
  });

  test("should tokenize complex expression", () => {
    const tokenizer = new AqlTokenizer('status = "passed" AND name ~= "test"');
    const tokens = tokenizer.tokenize();

    expect(tokens[0]).toMatchObject({ type: "IDENTIFIER", value: "status" });
    expect(tokens[1]).toMatchObject({ type: "EQ" });
    expect(tokens[2]).toMatchObject({ type: "STRING", value: '"passed"' });
    expect(tokens[3]).toMatchObject({ type: "AND" });
    expect(tokens[4]).toMatchObject({ type: "IDENTIFIER", value: "name" });
    expect(tokens[5]).toMatchObject({ type: "CONTAINS" });
    expect(tokens[6]).toMatchObject({ type: "STRING", value: '"test"' });
  });
});
