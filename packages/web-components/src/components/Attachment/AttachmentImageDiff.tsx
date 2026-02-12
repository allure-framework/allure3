import { ImageDiff } from "@/components/ImageDiff";
import { Spinner } from "@/components/Spinner";
import type { AttachmentProps } from "./model";
import styles from "./styles.scss";

export const AttachmentImageDiff = (props: AttachmentProps) => {
  const { attachment, i18n } = props;

  if (!attachment || !("diff" in attachment)) {
    return <Spinner />;
  }

  return (
    <div className={styles.imageDiffWrapper}>
      <ImageDiff diff={attachment.diff} i18n={i18n} />
    </div>
  );
};
