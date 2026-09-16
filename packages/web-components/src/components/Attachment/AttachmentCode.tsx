import { ansiSemanticColors, ansiToHTML, isAnsi, normalizeAnsiForegroundColors } from "@allurereport/web-commons";
import { useMemo } from "preact/hooks";

import { IconButton } from "../Button";
import { allureIcons } from "../SvgIcon";
import { TooltipWrapper } from "../Tooltip";
import type { AttachmentProps } from "./model";
import { Prism } from "./prism-setup.js";

import "./code.scss";
import styles from "./styles.scss";

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

const shouldShowLineNumbers = (prismLang: string, rawText: string): boolean => {
  if (prismLang === "markdown") {
    return false;
  }
  return rawText.split("\n").length >= 5;
};

const copyToClipboard = async (text: string) => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  } catch {}
};

export const AttachmentCode = (props: AttachmentProps & { highlight?: boolean }) => {
  const { attachment, item, highlight = true, i18n } = props;

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
  const canCopy = rawText.length > 0;
  const copyLabel = i18n?.("clipboard") ?? "Copy to clipboard";
  const copiedLabel = i18n?.("clipboardSuccess") ?? "Successfully copied";

  const copyAction = canCopy && (
    <div className={styles["attachment-code-actions"]}>
      <TooltipWrapper tooltipText={copyLabel} tooltipTextAfterClick={copiedLabel}>
        <IconButton
          style="raised"
          size="s"
          iconSize="s"
          icon={allureIcons.lineGeneralCopy3}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            copyToClipboard(rawText);
          }}
        />
      </TooltipWrapper>
    </div>
  );

  if (isAnsi(rawText) && rawText.length > 0 && highlight) {
    const sanitizedHtml = ansiToHTML(normalizeAnsiForegroundColors(rawText), {
      fg: "var(--color-text-primary)",
      bg: "none",
      colors: ansiSemanticColors,
    });

    return (
      <div className={styles["attachment-code"]}>
        <pre
          data-testid="code-attachment-content"
          className={preClass}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
        {copyAction}
      </div>
    );
  }

  return (
    <div className={styles["attachment-code"]}>
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
      {copyAction}
    </div>
  );
};
