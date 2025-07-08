import type { FunctionalComponent } from "preact";
import { sanitizeAttachmentHtml } from "@allurereport/web-components";
import * as styles from "./styles.scss";

// TODO: use proper type here
export type HtmlAttachmentPreviewProps = {
  attachment: { text: string };
};

export const HtmlAttachmentPreview: FunctionalComponent<HtmlAttachmentPreviewProps> = ({ attachment }) => {
  // Sanitize the HTML content to prevent XSS attacks
  const sanitizedHtml = sanitizeAttachmentHtml(attachment?.text || "");
  
  // eslint-disable-next-line react/no-danger
  return <div className={styles["html-attachment-preview"]} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
};
