import { ansiToHTML, isAnsi } from "@allurereport/web-commons";
import { useMemo } from "preact/hooks";

import type { AttachmentProps } from "./model";

import "./code.scss";
import { Prism } from "./prism-setup.js";

const extToPrismLanguage: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  json: "json",
  html: "markup",
  htm: "markup",
  xml: "markup",
  css: "css",
  csv: "csv",
  md: "markdown",
};

const contentTypeToPrismLanguage: Record<string, string> = {
  "text/javascript": "javascript",
  "application/javascript": "javascript",
  "text/x-javascript": "javascript",
  "application/x-javascript": "javascript",
  "text/ecmascript": "javascript",
  "application/ecmascript": "javascript",
  "text/typescript": "typescript",
  "application/typescript": "typescript",
  "text/x-typescript": "typescript",
  "application/x-typescript": "typescript",
  "application/json": "json",
  "text/json": "json",
  "text/html": "markup",
  "application/xml": "markup",
  "text/xml": "markup",
  "text/css": "css",
  "text/csv": "csv",
  "text/markdown": "markdown",
};

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const highlightCode = (text: string, language: string): string => {
  const grammar = Prism.languages[language];
  if (!grammar) {
    return escapeHtml(text);
  }
  try {
    return Prism.highlight(text, grammar, language);
  } catch {
    return escapeHtml(text);
  }
};

const semanticAnsiColor = {
  primary: 256,
  muted: 257,
  danger: 258,
  success: 259,
  warning: 260,
  info: 261,
  unknown: 262,
  decorative: 263,
} as const;

const ansiColors: Record<number, string> = {
  0: "var(--color-text-primary)",
  1: "var(--color-intent-danger-text)",
  2: "var(--color-intent-success-text)",
  3: "var(--color-intent-warning-text)",
  4: "var(--color-intent-info-text)",
  5: "var(--color-status-unknown-text)",
  6: "var(--color-decorative-5-text)",
  7: "var(--color-text-primary)",
  8: "var(--color-text-muted)",
  9: "var(--color-intent-danger-text)",
  10: "var(--color-intent-success-text)",
  11: "var(--color-intent-warning-text)",
  12: "var(--color-intent-info-text)",
  13: "var(--color-status-unknown-text)",
  14: "var(--color-decorative-5-text)",
  15: "var(--color-text-primary)",
  [semanticAnsiColor.primary]: "var(--color-text-primary)",
  [semanticAnsiColor.muted]: "var(--color-text-muted)",
  [semanticAnsiColor.danger]: "var(--color-intent-danger-text)",
  [semanticAnsiColor.success]: "var(--color-intent-success-text)",
  [semanticAnsiColor.warning]: "var(--color-intent-warning-text)",
  [semanticAnsiColor.info]: "var(--color-intent-info-text)",
  [semanticAnsiColor.unknown]: "var(--color-status-unknown-text)",
  [semanticAnsiColor.decorative]: "var(--color-decorative-5-text)",
};

const xtermColorLevels = [0, 95, 135, 175, 215, 255];

const getReadableAnsiColor = (red: number, green: number, blue: number) => {
  const brightness = red * 0.299 + green * 0.587 + blue * 0.114;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);

  if (red >= 150 && green >= 120 && blue <= 210 && red + green >= blue * 2.2) {
    return semanticAnsiColor.warning;
  }

  if (green >= red + 20 && green >= blue + 20) {
    return semanticAnsiColor.success;
  }

  if (red >= green + 30 && red >= blue + 30) {
    return semanticAnsiColor.danger;
  }

  if (blue >= red + 20 && blue >= green - 10) {
    return semanticAnsiColor.info;
  }

  if (red >= 120 && blue >= 120 && green <= max - 20) {
    return semanticAnsiColor.unknown;
  }

  if (max - min <= 32) {
    return brightness >= 150 || brightness <= 80 ? semanticAnsiColor.primary : semanticAnsiColor.muted;
  }

  return semanticAnsiColor.primary;
};

const getXtermColorRgb = (colorIndex: number) => {
  if (colorIndex >= 16 && colorIndex <= 231) {
    const cubeIndex = colorIndex - 16;

    return {
      red: xtermColorLevels[Math.floor(cubeIndex / 36)],
      green: xtermColorLevels[Math.floor((cubeIndex % 36) / 6)],
      blue: xtermColorLevels[cubeIndex % 6],
    };
  }

  if (colorIndex >= 232 && colorIndex <= 255) {
    const level = (colorIndex - 232) * 10 + 8;

    return {
      red: level,
      green: level,
      blue: level,
    };
  }
};

const isValidColorPart = (value: number) => Number.isInteger(value) && value >= 0 && value <= 255;

const normalizeAnsiForegroundColors = (text: string) =>
  text.replace(/\x1b\[([0-9;]*)m/g, (match, sequence: string) => {
    const codes = sequence.length === 0 ? [0] : sequence.split(";").map(Number);

    if (codes.some((code) => !Number.isInteger(code))) {
      return match;
    }

    const fragments: string[] = [];
    let displayCodes: number[] = [];
    const flushDisplayCodes = () => {
      if (displayCodes.length > 0) {
        fragments.push(`\x1b[${displayCodes.join(";")}m`);
        displayCodes = [];
      }
    };

    for (let index = 0; index < codes.length; ) {
      const code = codes[index];

      if (code === 38 && codes[index + 1] === 5 && isValidColorPart(codes[index + 2])) {
        const rgb = getXtermColorRgb(codes[index + 2]);

        flushDisplayCodes();
        fragments.push(
          `\x1b[38;5;${rgb ? getReadableAnsiColor(rgb.red, rgb.green, rgb.blue) : semanticAnsiColor.primary}m`,
        );
        index += 3;
        continue;
      }

      if (
        code === 38 &&
        codes[index + 1] === 2 &&
        isValidColorPart(codes[index + 2]) &&
        isValidColorPart(codes[index + 3]) &&
        isValidColorPart(codes[index + 4])
      ) {
        flushDisplayCodes();
        fragments.push(`\x1b[38;5;${getReadableAnsiColor(codes[index + 2], codes[index + 3], codes[index + 4])}m`);
        index += 5;
        continue;
      }

      if (code === 48 && codes[index + 1] === 5 && isValidColorPart(codes[index + 2])) {
        flushDisplayCodes();
        fragments.push(`\x1b[48;5;${codes[index + 2]}m`);
        index += 3;
        continue;
      }

      if (
        code === 48 &&
        codes[index + 1] === 2 &&
        isValidColorPart(codes[index + 2]) &&
        isValidColorPart(codes[index + 3]) &&
        isValidColorPart(codes[index + 4])
      ) {
        flushDisplayCodes();
        fragments.push(`\x1b[48;2;${codes[index + 2]};${codes[index + 3]};${codes[index + 4]}m`);
        index += 5;
        continue;
      }

      displayCodes.push(code);
      index += 1;
    }

    flushDisplayCodes();

    return fragments.join("");
  });

const languageFromName = (name?: string): string | undefined => {
  if (!name) {
    return undefined;
  }
  const match = /\.([a-z0-9]+)$/i.exec(name);
  if (!match) {
    return undefined;
  }
  const nameExt = match[1].toLowerCase();
  return extToPrismLanguage[nameExt] ?? nameExt;
};

const shouldShowLineNumbers = (prismLang: string, rawText: string): boolean => {
  if (prismLang === "markdown") {
    return false;
  }
  return rawText.split("\n").length >= 5;
};

export const AttachmentCode = (props: AttachmentProps & { highlight?: boolean }) => {
  const { attachment, item, highlight = true } = props;

  if (!attachment || !("text" in attachment)) {
    return null;
  }

  const ext = item?.link?.ext?.replace(".", "").toLowerCase();
  const contentType = item?.link?.contentType?.toLowerCase();
  const fileNameLang = languageFromName(item?.link?.name) ?? languageFromName(item?.link?.originalFileName);
  const prismLang =
    fileNameLang ||
    (ext && (extToPrismLanguage[ext] ?? ext)) ||
    (contentType && contentTypeToPrismLanguage[contentType]) ||
    "plaintext";
  const rawText = attachment.text ?? "";
  const showLineNumbers = shouldShowLineNumbers(prismLang, rawText);
  const preClass = useMemo(() => {
    const languageClass = highlight ? `language-${prismLang}` : "";
    const lineNumbersClass = highlight && showLineNumbers ? "line-numbers" : "";
    return ["attachment-code-block", languageClass, lineNumbersClass].filter(Boolean).join(" ");
  }, [highlight, prismLang, showLineNumbers]);

  const highlightedHtml = useMemo(
    () => (highlight ? highlightCode(rawText, prismLang) : null),
    [highlight, rawText, prismLang],
  );

  if (isAnsi(rawText) && rawText.length > 0 && highlight) {
    const sanitizedText = ansiToHTML(normalizeAnsiForegroundColors(rawText), {
      fg: "var(--color-text-primary)",
      bg: "none",
      colors: ansiColors,
    });

    return (
      <pre
        data-testid="code-attachment-content"
        className={preClass}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: sanitizedText }}
      />
    );
  }

  return (
    <pre data-testid="code-attachment-content" className={preClass}>
      {highlight && highlightedHtml !== null ? (
        <code
          className={`language-${prismLang}`}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <code>{rawText}</code>
      )}
    </pre>
  );
};
