import { sanitize } from "@allurereport/web-commons";
import type { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import * as styles from "./styles.scss";

// TODO: use proper type here
export type HtmlAttachmentPreviewProps = {
  attachment: { text: string };
};

export const HtmlAttachmentPreview: FunctionalComponent<HtmlAttachmentPreviewProps> = ({ attachment }) => {
  const [blobUrl, setBlobUrl] = useState<string>("");

  const rawText = attachment.text ?? "";
  const sanitizedText = rawText.length > 0 ? sanitize(rawText) : "";

  useEffect(() => {
    if (sanitizedText) {
      const blob = new Blob([sanitizedText], { type: "text/html" });
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
