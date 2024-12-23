import { useEffect, useState } from "preact/hooks";
import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";
import { EmptyComponent } from "@/components/TestResult/TestResultSteps/wrongAttachment";

export const AttachmentImage = ({ attachment }) => {
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
    return (
      <div className={styles["test-result-attachment-error"]}>
        <EmptyComponent />
      </div>
    );
  }
  return (
    <div className={styles["test-result-attachment-image"]}>
      {attachment?.img && <img src={attachment.img} alt={attachment.originalFileName} />}
    </div>
  );
};
