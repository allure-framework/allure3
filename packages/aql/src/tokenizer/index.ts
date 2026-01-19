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
    return { type: "WS", value: this.input.substring(startPos, this.position), position: startPos };
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

    let value = "";
    while (this.position < this.input.length) {
      if (this.currentChar() === "\\") {
        this.advance();
        if (this.position < this.input.length) {
          const escaped = this.currentChar();
          switch (escaped) {
            case "n":
              value += "\n";
              break;
            case "t":
              value += "\t";
              break;
            case "r":
              value += "\r";
              break;
            case "\\":
              value += "\\";
              break;
            case '"':
              value += '"';
              break;
            case "u": {
              // Unicode escape sequence \uXXXX
              this.advance();
              if (this.position + 4 > this.input.length) {
                throw AqlErrors.invalidUnicodeEscape(this.position);
              }
              const hexDigits = this.input.substring(this.position, this.position + 4);
              if (/^[0-9a-fA-F]{4}$/.test(hexDigits)) {
                value += String.fromCharCode(parseInt(hexDigits, 16));
                this.position += 4;
                continue;
              } else {
                throw AqlErrors.invalidUnicodeEscape(this.position);
              }
            }
            default:
              value += escaped;
          }
          this.advance();
        }
      } else if (this.currentChar() === '"') {
        this.advance(); // Skip closing quote
        return { type: "STRING", value: `"${value}"`, position: startPos };
      } else {
        /**
         * Accept any Unicode character in string values.
         * This includes Chinese, Japanese, Korean, Arabic, and all other Unicode characters.
         */
        value += this.currentChar();
        this.advance();
      }
    }

    throw AqlErrors.unterminatedString(startPos);
  }

  private readNumber(): AqlToken {
    const startPos = this.position;
    let value = "";

    // Minus sign
    if (this.currentChar() === "-") {
      value += this.currentChar();
      this.advance();
    }

    // Integer part
    while (this.position < this.input.length && this.isDigit(this.currentChar())) {
      value += this.currentChar();
      this.advance();
    }

    // Fractional part
    if (this.currentChar() === ".") {
      value += this.currentChar();
      this.advance();
      while (this.position < this.input.length && this.isDigit(this.currentChar())) {
        value += this.currentChar();
        this.advance();
      }
    }

    return { type: "NUMBER", value, position: startPos };
  }

  private readIdentifier(): AqlToken {
    const startPos = this.position;
    let value = "";

    while (this.position < this.input.length && this.isIdentifierChar(this.currentChar())) {
      value += this.currentChar();
      this.advance();
    }

    // Check keywords
    const lowerValue = value.toLowerCase();
    if (lowerValue === "and") {
      return { type: "AND", position: startPos };
    }
    if (lowerValue === "or") {
      return { type: "OR", position: startPos };
    }
    if (lowerValue === "not") {
      return { type: "NOT", position: startPos };
    }
    if (lowerValue === "in") {
      return { type: "IN", position: startPos };
    }
    if (lowerValue === "is") {
      return { type: "EQ", position: startPos };
    }
    if (lowerValue === "true" || lowerValue === "false") {
      return { type: "BOOLEAN", value, position: startPos };
    }
    if (lowerValue === "null" || lowerValue === "empty") {
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
    const slice = this.input.substring(this.position, this.position + str.length);
    if (slice === str) {
      this.position += str.length;
      return true;
    }
    return false;
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
