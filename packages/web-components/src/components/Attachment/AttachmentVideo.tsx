import { type FunctionalComponent } from "preact";
import { Spinner } from "@/components/Spinner";
import styles from "./styles.scss";

export const AttachmentVideo: FunctionalComponent<{
  attachment: { src: string; contentType?: string };
}> = ({ attachment }) => {
  if (!attachment) {
    return <Spinner />;
  }
  return (
    <video class={styles["test-result-attachment-video"]} controls loop muted>
      <source src={attachment?.src} type={attachment?.contentType} />
    </video>
  );
};
