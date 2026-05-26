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
};

const xtermColorLevels = [0, 95, 135, 175, 215, 255];

const getReadableXtermColor = (red: number, green: number, blue: number) => {
  const brightness = red * 0.299 + green * 0.587 + blue * 0.114;

  if (red >= 175 && green >= 135 && blue <= 135) {
    return "var(--color-intent-warning-text)";
  }

  if (green >= 175 && red <= 175 && blue <= 175) {
    return "var(--color-intent-success-text)";
  }

  if (red >= 175 && green <= 135 && blue <= 135) {
    return "var(--color-intent-danger-text)";
  }

  if (blue >= 175 && red <= 175) {
    return "var(--color-intent-info-text)";
  }

  if (red >= 135 && blue >= 135 && green <= 135) {
    return "var(--color-status-unknown-text)";
  }

  if (brightness >= 175) {
    return "var(--color-text-primary)";
  }
};

for (let colorIndex = 16; colorIndex <= 231; colorIndex++) {
  const cubeIndex = colorIndex - 16;
  const red = xtermColorLevels[Math.floor(cubeIndex / 36)];
  const green = xtermColorLevels[Math.floor((cubeIndex % 36) / 6)];
  const blue = xtermColorLevels[cubeIndex % 6];
  const color = getReadableXtermColor(red, green, blue);

  if (color) {
    ansiColors[colorIndex] = color;
  }
}

for (let colorIndex = 250; colorIndex <= 255; colorIndex++) {
  ansiColors[colorIndex] = "var(--color-text-primary)";
}

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
    const sanitizedText = ansiToHTML(rawText, {
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
