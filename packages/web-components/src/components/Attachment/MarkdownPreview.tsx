import { proseStyles, resolveCssVarDeclarations, sanitizeIframeHtml, themeStore } from "@allurereport/web-commons";
import MarkdownIt from "markdown-it";
import type { FunctionalComponent } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import styles from "./styles.scss";

const md = new MarkdownIt();

const getIframeContentHeight = (iframe: HTMLIFrameElement) => {
  const documentElement = iframe.contentDocument?.documentElement;
  const body = iframe.contentDocument?.body;
  const bodyRectHeight = body?.getBoundingClientRect().height ?? 0;
  const scrollHeight = Math.max(body?.scrollHeight ?? 0, documentElement?.scrollHeight ?? 0);

  return Math.ceil(Math.max(bodyRectHeight, scrollHeight));
};

export type MarkdownAttachmentPreviewProps = {
  attachment: { text: string };
};

export const MarkdownPreview: FunctionalComponent<MarkdownAttachmentPreviewProps> = ({ attachment }) => {
  const [blobUrl, setBlobUrl] = useState("");
  const [height, setHeight] = useState(0);
  const currentTheme = themeStore.value.current;

  const rawText = attachment.text ?? "";
  const sanitized = useMemo(() => {
    if (!rawText) {
      return "";
    }
    return sanitizeIframeHtml(md.render(rawText));
  }, [rawText]);

  useEffect(() => {
    if (!sanitized) {
      setBlobUrl("");
      return;
    }

    const iframeThemeVars = resolveCssVarDeclarations(proseStyles);
    const html = `<!DOCTYPE html>
<html data-theme="${currentTheme}">
  <head>
    <meta charset="utf-8">
    <style>:root {${iframeThemeVars}}</style>
    <style>${proseStyles}</style>
    <style>html, body { margin: 0; }</style>
  </head>
  <body>${sanitized}</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);

    return () => URL.revokeObjectURL(url);
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
      {blobUrl && (
        <iframe
          title="Markdown attachment"
          src={blobUrl}
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
