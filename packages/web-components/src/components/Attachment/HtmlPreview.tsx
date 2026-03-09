import { sanitize } from "@allurereport/web-commons";
import type { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";

import styles from "./styles.scss";

const isDarkTheme = (): boolean => {
  const theme = typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null;
  if (theme === "dark") {
    return true;
  }
  if (theme === "light") {
    return false;
  }
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const DARK_STYLE =
  "<style data-allure-preview-theme>:root,html,body{background:#1c1c1e !important;color:#e5e5e7 !important;}body *{border-color:rgba(255,255,255,0.12) !important;}</style>";

export type HtmlAttachmentPreviewProps = {
  attachment: { text: string };
};

export const HtmlPreview: FunctionalComponent<HtmlAttachmentPreviewProps> = ({ attachment }) => {
  const [blobUrl, setBlobUrl] = useState<string>("");

  const rawText = attachment.text ?? "";
  const sanitizedText = rawText.length > 0 ? sanitize(rawText) : "";

  useEffect(() => {
    if (sanitizedText) {
      let wrapped = sanitizedText;
      if (isDarkTheme()) {
        if (/<head(\s[^>]*)?>/i.test(sanitizedText)) {
          wrapped = sanitizedText.replace(/<head(\s[^>]*)?>/i, (m) => m + DARK_STYLE);
        } else if (/<body(\s[^>]*)?>/i.test(sanitizedText)) {
          wrapped = sanitizedText.replace(/<body(\s[^>]*)?>/i, (m) => m + DARK_STYLE);
        } else {
          wrapped = DARK_STYLE + sanitizedText;
        }
      }
      const blob = new Blob([wrapped], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [sanitizedText]);

  if (!sanitizedText) {
    return null;
  }

  return (
    <div className={styles["html-attachment-preview"]}>
      <iframe src={blobUrl} width="100%" height="100%" frameBorder="0" sandbox="allow-same-origin" />
    </div>
  );
};
