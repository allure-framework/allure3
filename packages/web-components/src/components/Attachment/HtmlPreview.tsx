import type { FunctionalComponent } from "preact";
import styles from "./styles.scss";

// TODO: use proper type here
export type HtmlAttachmentPreviewProps = {
  attachment: { text: string };
};

export const HtmlPreview: FunctionalComponent<HtmlAttachmentPreviewProps> = ({ attachment }) => {
  // eslint-disable-next-line react/no-danger
  return <div className={styles["html-attachment-preview"]} dangerouslySetInnerHTML={{ __html: attachment?.text }} />;
};
