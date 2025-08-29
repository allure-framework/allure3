import type { FunctionalComponent } from "preact";
import * as styles from "./styles.scss";
import { sanitize } from "@allurereport/web-commons";

// TODO: use proper type here
export type HtmlAttachmentPreviewProps = {
  attachment: { text: string };
};

export const HtmlAttachmentPreview: FunctionalComponent<HtmlAttachmentPreviewProps> = ({ attachment }) => {
  const sanitizedText = typeof attachment?.text === "string" && attachment.text.length > 0 ? sanitize(attachment.text) : "";

  // eslint-disable-next-line react/no-danger
  return <div className={styles["html-attachment-preview"]} dangerouslySetInnerHTML={{ __html: sanitizedText }} />;
};
