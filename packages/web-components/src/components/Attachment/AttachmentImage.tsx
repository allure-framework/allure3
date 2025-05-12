import { type FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import styles from "./styles.scss";

export const AttachmentImage: FunctionalComponent<{
  attachment: { img: string; originalFileName: string };
}> = ({ attachment }) => {
  const [isValidImage, setIsValidImage] = useState(true);

  useEffect(() => {
    if (attachment?.img) {
      const img = new Image();
      img.onload = () => setIsValidImage(true);
      img.onerror = () => setIsValidImage(false);
      img.src = attachment.img;
    }
  }, [attachment?.img]);

  if (!attachment?.img || !isValidImage) {
    return <div className={styles["test-result-attachment-error"]}>something went wrong</div>;
  }
  return (
    <div data-testid={"image-attachment-content"} className={styles["test-result-attachment-image"]}>
      {attachment?.img && <img src={attachment.img} alt={attachment.originalFileName} />}
    </div>
  );
};
