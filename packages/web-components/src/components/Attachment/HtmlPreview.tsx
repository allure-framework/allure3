import type { FunctionalComponent } from "preact";
import { sanitizeAttachmentHtml } from "../../utils/sanitize";
import styles from "./styles.scss";

// TODO: use proper type here
export type HtmlAttachmentPreviewProps = {
  attachment: { text: string };
};

export const HtmlPreview: FunctionalComponent<HtmlAttachmentPreviewProps> = ({ attachment }) => {
  // Sanitize the HTML content to prevent XSS attacks
  const sanitizedHtml = sanitizeAttachmentHtml(attachment?.text || "");
  
  // eslint-disable-next-line react/no-danger
  return <div className={styles["html-attachment-preview"]} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
};
