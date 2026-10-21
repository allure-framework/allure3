import { proseStyles, resolveCssVarDeclarations, sanitizeIframeHtml, themeStore } from "@allurereport/web-commons";
import MarkdownIt from "markdown-it";
import type { FunctionalComponent } from "preact";
import { useMemo, useState } from "preact/hooks";

import { getIframeContentHeight } from "./iframe";

import styles from "./styles.scss";

const md = new MarkdownIt();

export type MarkdownAttachmentPreviewProps = {
  attachment: { text: string };
};

export const MarkdownPreview: FunctionalComponent<MarkdownAttachmentPreviewProps> = ({ attachment }) => {
  const [height, setHeight] = useState(0);
  const currentTheme = themeStore.value.current;

  const rawText = attachment.text ?? "";
  const sanitized = useMemo(() => {
    if (!rawText) {
      return "";
    }
    return sanitizeIframeHtml(md.render(rawText));
  }, [rawText]);

  const srcDoc = useMemo(() => {
    if (!sanitized) return "";

    const iframeThemeVars = resolveCssVarDeclarations(proseStyles);
    return `<!DOCTYPE html>
<html data-theme="${currentTheme}">
  <head>
    <meta charset="utf-8">
    <style>:root {${iframeThemeVars}}</style>
    <style>${proseStyles}</style>
    <style>html, body { margin: 0; } body { padding: 8px 0; }</style>
  </head>
  <body>${sanitized}</body>
</html>`;
  }, [currentTheme, sanitized]);

  const handleLoad = (e: Event) => {
    const iframe = e.currentTarget as HTMLIFrameElement;
    setHeight(getIframeContentHeight(iframe));
  };

  if (!sanitized) {
    return null;
  }

  return (
    <div className={styles["markdown-attachment-preview"]} data-testid="markdown-attachment-preview">
      {srcDoc && (
        <iframe
          title="Markdown attachment"
          srcDoc={srcDoc}
          width="100%"
          height={height || undefined}
          frameBorder={0}
          sandbox="allow-same-origin"
          onLoad={handleLoad}
        />
      )}
    </div>
  );
};
