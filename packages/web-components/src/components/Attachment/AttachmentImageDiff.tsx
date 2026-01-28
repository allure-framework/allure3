import { ImageDiff } from "@/components/ImageDiff";
import { Spinner } from "@/components/Spinner";
import type { AttachmentProps } from "./model";
import styles from "./styles.scss";

export const AttachmentImageDiff = (props: AttachmentProps) => {
  const { attachment } = props;

  if (!attachment || !("diff" in attachment)) {
    return <Spinner />;
  }

  return (
    <div className={styles.imageDiffWrapper}>
      <ImageDiff diff={attachment.diff} />
    </div>
  );
};
