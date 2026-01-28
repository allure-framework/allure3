import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { attachmentType } from "@allurereport/web-commons";
import type { FunctionalComponent } from "preact";
import { Attachment } from "@/components/Attachment";
import ModalThumb from "@/components/Modal/Thumb";
import type { ModalGalleryProps } from "@/components/Modal/index";
import styles from "./styles.scss";

const Gallery: FunctionalComponent<ModalGalleryProps> = ({ attachments = [] }) => {
  const filteredAttachments = attachments?.filter(({ link: { contentType } }: AttachmentTestStepResult) => {
    const type = attachmentType(contentType);

    return !["archive", null].includes(type);
  });

  return (
    <div className={styles["modal-gallery"]}>
      {filteredAttachments?.map((item) => (
        <ModalThumb item={item} key={item?.link?.id}>
          <Attachment item={item} />
        </ModalThumb>
      ))}
    </div>
  );
};
export default Gallery;
