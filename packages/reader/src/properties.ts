/**
 * The implementation is based on https://github.com/gagle/node-properties.
 */
export const parseProperties = (input: string): Record<string, string | undefined> => {
  if (!input) {
    return {};
  }

  const result: Record<string, string | undefined> = {};
  let escape = false;
  let skipSpace = true;
  let isCommentLine = false;
  let newLine = true;
  let multiLine = false;
  let isKey = true;
  let key = "";
  let value = "";
  let unicode: number;
  let unicodeRemaining = 0;
  let escapingUnicode = false;
  let keySpace = false;
  let sep = false;

  const line = () => {
    if (key || value || sep) {
      result[key] = value;
      key = "";
      value = "";
      sep = false;
    }
  };

  const decodeString = (output: string, char: string) => {
    if (escapingUnicode && unicodeRemaining) {
      // eslint-disable-next-line no-bitwise
      unicode = (unicode << 4) + hex(char);
      if (--unicodeRemaining) {
        return output;
      }
      escape = false;
      escapingUnicode = false;
      return output + String.fromCharCode(unicode);
    }

    if (char === "u") {
      unicode = 0;
      escapingUnicode = true;
      unicodeRemaining = 4;
      return output;
    }

    escape = false;

    switch (char) {
      case "t":
        return `${output}\t`;
      case "r":
        return `${output}\r`;
      case "n":
        return `${output}\n`;
      case "f":
        return `${output}\f`;
    }

    return output + char;
  };

  for (const char of input) {
    if (char === "\r") {
      continue;
    }

    if (isCommentLine) {
      if (char === "\n") {
        isCommentLine = false;
        newLine = true;
        skipSpace = true;
      }
      continue;
    }

    if (skipSpace) {
      if (isWhitespace(char)) {
        continue;
      }

      if (!multiLine && char === "\n") {
        isKey = true;
        keySpace = false;
        newLine = true;
        line();
        continue;
      }
      skipSpace = false;
      multiLine = false;
    }

    if (newLine) {
      newLine = false;
      if (isComment(char)) {
        isCommentLine = true;
        continue;
      }
    }

    if (char !== "\n") {
      if (!escape && isKey && isSeparator(char)) {
        sep = true;
        isKey = false;
        keySpace = false;
        skipSpace = true;
        continue;
      }

      if (char === "\\") {
        if (escape) {
          if (escapingUnicode) {
            continue;
          }

          if (keySpace) {
            keySpace = false;
            isKey = false;
          }

          if (isKey) {
            key += "\\";
          } else {
            value += "\\";
          }
        }
        escape = !escape;
      } else {
        if (keySpace) {
          keySpace = false;
          isKey = false;
        }

        if (isKey) {
          if (escape) {
            key = decodeString(key, char);
          } else {
            if (isWhitespace(char)) {
              keySpace = true;
              skipSpace = true;
              continue;
            }
            key += char;
          }
        } else {
          if (escape) {
            value = decodeString(value, char);
          } else {
            value += char;
          }
        }
      }
    } else {
      if (escape) {
        if (!escapingUnicode) {
          escape = false;
        }
        skipSpace = true;
        multiLine = true;
      } else {
        newLine = true;
        skipSpace = true;
        isKey = true;

        line();
      }
    }
  }

  line();

  return result;
};

const hex = (char: string) => {
  switch (char) {
    case "0":
      return 0;
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5":
      return 5;
    case "6":
      return 6;
    case "7":
      return 7;
    case "8":
      return 8;
    case "9":
      return 9;
    case "a":
    case "A":
      return 10;
    case "b":
    case "B":
      return 11;
    case "c":
    case "C":
      return 12;
    case "d":
    case "D":
      return 13;
    case "e":
    case "E":
      return 14;
    case "f":
    case "F":
      return 15;
  }
  throw new Error(`Non-hex char ${char}`);
};

const isWhitespace = (char: string) => {
  switch (char) {
    case "\t":
    case "\f":
    case " ":
      return true;
  }
  return false;
};

const isSeparator = (char: string) => {
  switch (char) {
    case "=":
    case ":":
      return true;
  }
  return false;
};

const isComment = (char: string) => {
  switch (char) {
    case "#":
    case "!":
      return true;
  }
  return false;
};
