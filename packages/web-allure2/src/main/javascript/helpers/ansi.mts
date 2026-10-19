import {
  ansiSemanticColors,
  ansiToHTML,
  normalizeAnsiForegroundColors,
  normalizeEscapedAnsiSequences,
} from "@allurereport/web-commons";

const ansi = (input: unknown): string =>
  ansiToHTML(normalizeAnsiForegroundColors(normalizeEscapedAnsiSequences(input == null ? "" : String(input))), {
    fg: "var(--color-text-primary)",
    bg: "none",
    newline: true,
    colors: ansiSemanticColors,
  });

export default ansi;
