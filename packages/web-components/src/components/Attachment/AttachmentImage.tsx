import { useEffect, useState } from "preact/hooks";
import type { AttachmentProps } from "./model";
import styles from "./styles.scss";

export const AttachmentImage = (props: AttachmentProps) => {
  const { attachment, item } = props;

  const [isValidImage, setIsValidImage] = useState(true);

  useEffect(() => {
    if (attachment && "img" in attachment && attachment.img) {
      const img = new Image();
      img.onload = () => setIsValidImage(true);
      img.onerror = () => setIsValidImage(false);
      img.src = attachment.img;
    }
  }, [attachment]);

  if (!(attachment && "img" in attachment) || !isValidImage) {
    return <div className={styles["test-result-attachment-error"]}>something went wrong</div>;
  }

  return (
    <div data-testid={"image-attachment-content"} className={styles["test-result-attachment-image"]}>
      <img src={attachment.img} alt={item.link.originalFileName} />
    </div>
  );
};
