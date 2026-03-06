import { ansiToHTML, isAnsi } from "@allurereport/web-commons";
import Prism from "prismjs";
import "prismjs/components/prism-css";
import "prismjs/components/prism-csv";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-typescript";
import "./code.scss";
import type { AttachmentProps } from "./model";

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

  if (isAnsi(rawText) && rawText.length > 0 && highlight) {
    const sanitizedText = ansiToHTML(rawText, {
      fg: "var(--on-text-primary)",
      bg: "none",
      colors: {
        0: "none",
        1: "none",
        2: "var(--on-support-sirius)",
        3: "var(--on-support-atlas)",
        4: "var(--bg-support-skat)",
        5: "var(--on-support-betelgeuse)",
      },
    });

    return (
      <pre
        data-testid="code-attachment-content"
        key={item?.link?.id}
        className={highlight ? `language-${prismLang} line-numbers` : "attachment-code-plain"}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: sanitizedText }}
      />
    );
  }

  if (!highlight) {
    return (
      <pre data-testid="code-attachment-content" key={item?.link?.id} className="attachment-code-plain">
        <code>{rawText}</code>
      </pre>
    );
  }

  const highlightedHtml = highlightCode(rawText, prismLang);
  const preClass = `language-${prismLang} line-numbers`;

  return (
    <pre data-testid={"code-attachment-content"} key={item?.link?.id} className={preClass}>
      <code
        className={`language-${prismLang}`}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    </pre>
  );
};
