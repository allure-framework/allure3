import { Spinner } from "@/components/Spinner";
import type { AttachmentProps } from "./model";
import styles from "./styles.scss";

export const AttachmentVideo = ({ attachment, item }: AttachmentProps) => {
  if (!attachment || !("src" in attachment)) {
    return <Spinner />;
  }

  return (
    <video data-testid={"video-attachment-content"} class={styles["test-result-attachment-video"]} controls loop muted>
      <source src={attachment.src} type={item.link.contentType} />
    </video>
  );
};
