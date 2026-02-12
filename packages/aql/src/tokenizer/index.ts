/**
 * Tokenizer for AQL
 */
import { AqlErrors } from "../errors/index.js";
import type { AqlToken } from "../model.js";

/**
 * Tokenizer for AQL (Allure Query Language).
 * Converts AQL strings into tokens for parsing.
 */
export class AqlTokenizer {
  private input: string;
  private position: number = 0;
  private tokens: AqlToken[] = [];

  /**
   * Creates a new AQL tokenizer instance.
   *
   * @param input - The AQL string to tokenize
   */
  constructor(input: string) {
    this.input = input;
  }

  /**
   * Tokenizes the input string into an array of tokens.
   *
   * @returns Array of tokens representing the AQL string
   * @throws {AqlTokenizerError} If the input contains invalid characters or unterminated strings
   */
  tokenize(): AqlToken[] {
    this.position = 0;
    this.tokens = [];

    while (this.position < this.input.length) {
      const token = this.nextToken();
      if (token.type !== "WS") {
        this.tokens.push(token);
      }
    }

    this.tokens.push({ type: "EOL", position: this.position });
    return this.tokens;
  }

  private nextToken(): AqlToken {
    const startPos = this.position;

    if (this.position >= this.input.length) {
      return { type: "EOL", position: startPos };
    }

    // Skip whitespace
    if (this.isWhitespace(this.currentChar())) {
      return this.readWhitespace();
    }

    // Operators (multi-character first)
    if (this.match(">=")) {
      return { type: "GE", position: startPos };
    }
    if (this.match("<=")) {
      return { type: "LE", position: startPos };
    }
    if (this.match("!=")) {
      return { type: "NEQ", position: startPos };
    }
    if (this.match("~=")) {
      return { type: "CONTAINS", position: startPos };
    }

    // Single character operators
    if (this.currentChar() === ">") {
      this.advance();
      return { type: "GT", position: startPos };
    }
    if (this.currentChar() === "<") {
      this.advance();
      return { type: "LT", position: startPos };
    }
    if (this.currentChar() === "=") {
      this.advance();
      return { type: "EQ", position: startPos };
    }

    // Brackets
    if (this.currentChar() === "(") {
      this.advance();
      return { type: "LPAREN", position: startPos };
    }
    if (this.currentChar() === ")") {
      this.advance();
      return { type: "RPAREN", position: startPos };
    }
    if (this.currentChar() === "[") {
      this.advance();
      return { type: "LBRACKET", position: startPos };
    }
    if (this.currentChar() === "]") {
      this.advance();
      return { type: "RBRACKET", position: startPos };
    }
    if (this.currentChar() === ",") {
      this.advance();
      return { type: "COMMA", position: startPos };
    }

    // Strings
    if (this.currentChar() === '"') {
      return this.readString();
    }

    // Numbers
    if (this.isDigit(this.currentChar()) || (this.currentChar() === "-" && this.isDigit(this.peek()))) {
      return this.readNumber();
    }

    // Identifiers and keywords
    if (this.isIdentifierStart(this.currentChar())) {
      return this.readIdentifier();
    }

    // Unknown character
    const char = this.currentChar();
    this.advance();
    throw AqlErrors.unexpectedCharacter(char, startPos);
  }

  private readWhitespace(): AqlToken {
    const startPos = this.position;
    while (this.position < this.input.length && this.isWhitespace(this.currentChar())) {
      this.advance();
    }
    return { type: "WS", position: startPos };
  }

  /**
   * Reads a string token.
   * Supports all Unicode characters including Chinese, Japanese, Korean, etc.
   * String values can contain any Unicode characters, not just identifiers.
   * Correctly handles brackets (), [], operators (>=, <=, etc.), and other special
   * characters inside strings - they are treated as regular characters, not as tokens.
   * Only the closing quote (") terminates the string.
   */
  private readString(): AqlToken {
    const startPos = this.position;
    this.advance(); // Skip opening quote

    const chars: string[] = [];

    while (this.position < this.input.length) {
      if (this.currentChar() === "\\") {
        this.advance();
        if (this.position < this.input.length) {
          const escaped = this.currentChar();
          switch (escaped) {
            case "n":
              chars.push("\n");
              break;
            case "t":
              chars.push("\t");
              break;
            case "r":
              chars.push("\r");
              break;
            case "\\":
              chars.push("\\");
              break;
            case '"':
              chars.push('"');
              break;
            case "u": {
              // Unicode escape sequence \uXXXX
              this.advance();
              if (this.position + 4 > this.input.length) {
                throw AqlErrors.invalidUnicodeEscape(this.position);
              }
              let hexValue = 0;
              for (let i = 0; i < 4; i++) {
                const char = this.input[this.position + i];
                const code = char?.charCodeAt(0) ?? 0;
                let digit: number;
                if (code >= 48 && code <= 57) {
                  // '0'-'9'
                  digit = code - 48;
                } else if (code >= 65 && code <= 70) {
                  // 'A'-'F'
                  digit = code - 55;
                } else if (code >= 97 && code <= 102) {
                  // 'a'-'f'
                  digit = code - 87;
                } else {
                  throw AqlErrors.invalidUnicodeEscape(this.position);
                }
                hexValue = hexValue * 16 + digit;
              }
              chars.push(String.fromCharCode(hexValue));
              this.position += 4;
              continue;
            }
            default:
              chars.push(escaped);
          }
          this.advance();
        }
      } else if (this.currentChar() === '"') {
        this.advance(); // Skip closing quote
        const value = chars.join("");
        return { type: "STRING", value: `"${value}"`, position: startPos };
      } else {
        /**
         * Accept any Unicode character in string values.
         * This includes Chinese, Japanese, Korean, Arabic, and all other Unicode characters.
         */
        chars.push(this.currentChar());
        this.advance();
      }
    }

    throw AqlErrors.unterminatedString(startPos);
  }

  private readNumber(): AqlToken {
    const startPos = this.position;
    const chars: string[] = [];

    // Minus sign
    if (this.currentChar() === "-") {
      chars.push(this.currentChar());
      this.advance();
    }

    // Integer part
    while (this.position < this.input.length && this.isDigit(this.currentChar())) {
      chars.push(this.currentChar());
      this.advance();
    }

    // Fractional part
    if (this.currentChar() === ".") {
      chars.push(this.currentChar());
      this.advance();
      while (this.position < this.input.length && this.isDigit(this.currentChar())) {
        chars.push(this.currentChar());
        this.advance();
      }
    }

    const value = chars.join("");
    return { type: "NUMBER", value, position: startPos };
  }

  private readIdentifier(): AqlToken {
    const startPos = this.position;
    const chars: string[] = [];

    while (this.position < this.input.length && this.isIdentifierChar(this.currentChar())) {
      chars.push(this.currentChar());
      this.advance();
    }

    const value = chars.join("");
    const length = value.length;

    // Check keywords using helper functions
    if (this.isKeywordAnd(value, length)) {
      return { type: "AND", position: startPos };
    }
    if (this.isKeywordOr(value, length)) {
      return { type: "OR", position: startPos };
    }
    if (this.isKeywordNot(value, length)) {
      return { type: "NOT", position: startPos };
    }
    if (this.isKeywordIn(value, length)) {
      return { type: "IN", position: startPos };
    }
    if (this.isKeywordIs(value, length)) {
      return { type: "EQ", position: startPos };
    }
    if (this.isKeywordBoolean(value)) {
      return { type: "BOOLEAN", value, position: startPos };
    }
    if (this.isKeywordNull(value)) {
      return { type: "NULL", position: startPos };
    }

    // Check function (identifier with "()")
    if (this.currentChar() === "(" && this.peek() === ")") {
      this.advance(); // (
      this.advance(); // )
      return { type: "FUNCTION", value: `${value}()`, position: startPos };
    }

    return { type: "IDENTIFIER", value, position: startPos };
  }

  /**
   * Case-insensitive comparison helper for short strings (optimized for keywords)
   * Compares characters directly by their codes to avoid creating new strings
   */
  private equalsIgnoreCase(str: string, target: string): boolean {
    if (str.length !== target.length) {
      return false;
    }

    for (let i = 0; i < str.length; i++) {
      const strCode = str.charCodeAt(i);
      const targetCode = target.charCodeAt(i);
      // Convert both to lowercase by comparing codes directly
      // 'A' (65) to 'Z' (90) -> 'a' (97) to 'z' (122)
      // 'a' (97) to 'z' (122) stays the same
      const strLower = strCode >= 65 && strCode <= 90 ? strCode + 32 : strCode;
      const targetLower = targetCode >= 65 && targetCode <= 90 ? targetCode + 32 : targetCode;
      if (strLower !== targetLower) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if first character matches (case-insensitive) without creating new string
   */
  private firstCharMatches(value: string, char: string): boolean {
    if (!value || value.length === 0) {
      return false;
    }
    const valueCode = value.charCodeAt(0);
    const charCode = char.charCodeAt(0);
    // Convert both to lowercase for comparison
    const valueLower = valueCode >= 65 && valueCode <= 90 ? valueCode + 32 : valueCode;
    const charLower = charCode >= 65 && charCode <= 90 ? charCode + 32 : charCode;
    return valueLower === charLower;
  }

  /**
   * Check if identifier is "and" keyword
   */
  private isKeywordAnd(value: string, length: number): boolean {
    return length === 3 && this.firstCharMatches(value, "a") && this.equalsIgnoreCase(value, "and");
  }

  /**
   * Check if identifier is "or" keyword
   */
  private isKeywordOr(value: string, length: number): boolean {
    return length === 2 && this.firstCharMatches(value, "o") && this.equalsIgnoreCase(value, "or");
  }

  /**
   * Check if identifier is "not" keyword
   */
  private isKeywordNot(value: string, length: number): boolean {
    return length === 3 && this.firstCharMatches(value, "n") && this.equalsIgnoreCase(value, "not");
  }

  /**
   * Check if identifier is "in" keyword
   */
  private isKeywordIn(value: string, length: number): boolean {
    return length === 2 && this.firstCharMatches(value, "i") && this.equalsIgnoreCase(value, "in");
  }

  /**
   * Check if identifier is "is" keyword
   */
  private isKeywordIs(value: string, length: number): boolean {
    return length === 2 && this.firstCharMatches(value, "i") && this.equalsIgnoreCase(value, "is");
  }

  /**
   * Check if identifier is boolean keyword ("true" or "false")
   */
  private isKeywordBoolean(value: string): boolean {
    return this.equalsIgnoreCase(value, "true") || this.equalsIgnoreCase(value, "false");
  }

  /**
   * Check if identifier is null keyword ("null" or "empty")
   */
  private isKeywordNull(value: string): boolean {
    return this.equalsIgnoreCase(value, "null") || this.equalsIgnoreCase(value, "empty");
  }

  private currentChar(): string {
    return this.input[this.position] || "";
  }

  private peek(): string {
    return this.input[this.position + 1] || "";
  }

  private advance(): void {
    this.position++;
  }

  private match(str: string): boolean {
    if (this.position + str.length > this.input.length) {
      return false;
    }

    for (let i = 0; i < str.length; i++) {
      if (this.input[this.position + i] !== str[i]) {
        return false;
      }
    }

    this.position += str.length;
    return true;
  }

  private isWhitespace(char: string): boolean {
    if (!char) {
      return false;
    }
    const code = char.charCodeAt(0);
    return (
      code === 0x20 || // space
      code === 0x09 || // tab
      code === 0x0a || // newline
      code === 0x0d || // carriage return
      code === 0x0c // form feed
    );
  }

  private isDigit(char: string): boolean {
    if (!char) {
      return false;
    }
    const code = char.charCodeAt(0);
    return code >= 0x30 && code <= 0x39; // '0' to '9'
  }

  /**
   * Checks if character can start an identifier.
   * Supports: Latin letters (a-z, A-Z) and underscore (_).
   */
  private isIdentifierStart(char: string): boolean {
    if (!char) {
      return false;
    }
    const code = char.charCodeAt(0);
    return (
      (code >= 0x41 && code <= 0x5a) || // A-Z
      (code >= 0x61 && code <= 0x7a) || // a-z
      code === 0x5f // _
    );
  }

  /**
   * Checks if character can be part of an identifier.
   * Supports: Latin letters (a-z, A-Z) and underscore (_).
   */
  private isIdentifierChar(char: string): boolean {
    if (!char) {
      return false;
    }
    const code = char.charCodeAt(0);
    return (
      (code >= 0x41 && code <= 0x5a) || // A-Z
      (code >= 0x61 && code <= 0x7a) || // a-z
      code === 0x5f // _
    );
  }
}
