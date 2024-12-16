import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import Prism from "prismjs";
import LineGeneralDownloadCloud from "@/assets/svg/line-general-download-cloud.svg";
import LineGeneralCopy from "@/assets/svg/line-general-link-external.svg";
import LineGeneralXClose from "@/assets/svg/line-general-x-close.svg";
import ViewOffIcon from "@/assets/svg/view-off.svg";
import ViewIcon from "@/assets/svg/view.svg";
import { Attachment } from "@/components/app/TestResult/TestResultSteps/attachment";
import { Button, IconButton } from "@/components/commons/Button";
import { GalleryThumb } from "@/components/commons/Gallery/GalleryThumb";
import { closeModal, modalData } from "@/components/commons/Modal";
import * as styles from "@/components/commons/Modal/styles.scss";
import { TooltipWrapper } from "@/components/commons/Tooltip";
import { Heading } from "@/components/commons/Typography";
import { attachmentType, downloadAttachment, openAttachmentInNewTab } from "@/utils/attachments";

export type ModalGalleryProps = {
  attachments: AttachmentTestStepResult[];
};

const GalleryCarousel: FunctionalComponent<ModalGalleryProps> = ({ attachments = [] }) => {
  const filteredAttachments = attachments.filter(({ link: { contentType } }: AttachmentTestStepResult) => {
    const type = attachmentType(contentType).type;

    return !["archive", null].includes(type as string);
  });

  return (
    <div className={styles["modal-gallery"]}>
      {filteredAttachments.map((item, index) => (
        <GalleryThumb item={item} key={index}>
          <Attachment item={item} />
        </GalleryThumb>
      ))}
    </div>
  );
};

export const Gallery = ({ testResult }) => {
  const { link } = modalData.value.data || {};
  const attachName = link?.name ? `${link?.name}` : `${link?.id}${link?.ext}`;
  const isImageAttachment = link?.contentType?.startsWith("image");
  const isHtmlAttachment = link?.contentType === "text/html";

  const downloadData = async (e: Event) => {
    e.stopPropagation();
    const { id, ext, contentType } = link || {};
    if (id && ext && contentType) {
      await downloadAttachment(id, ext, contentType);
    }
  };

  const openInNewWindow = async () => {
    const { id, ext, contentType } = link || {};
    await openAttachmentInNewTab(id, ext, contentType);
  };

  return (
    <>
      <div className={`${styles["gallery-wrapper"]}`}>
        <div className={styles["gallery-top"]}>
          <Heading size={"s"}>{attachName}</Heading>
          <div className={styles["gallery-buttons"]}>
            {isImageAttachment && (
              <Button style={"outline"} onClick={openInNewWindow} icon={LineGeneralCopy.id} text={"Open in new tab"} />
            )}
            {isHtmlAttachment && (
              <TooltipWrapper tooltipText={"Preview attachment"}>
                <IconButton
                  style={"outline"}
                  size={"m"}
                  iconSize={"s"}
                  icon={modalData.value.preview ? ViewOffIcon.id : ViewIcon.id}
                  onClick={() => {
                    modalData.value = {
                      ...modalData.value,
                      preview: !modalData.value.preview,
                    };
                  }}
                />
              </TooltipWrapper>
            )}
            <TooltipWrapper tooltipText={"Download attachment"}>
              <IconButton
                style={"outline"}
                size={"m"}
                iconSize={"s"}
                icon={LineGeneralDownloadCloud.id}
                onClick={(e: MouseEvent) => downloadData(e)}
              />
            </TooltipWrapper>
            <IconButton iconSize={"m"} style={"ghost"} onClick={closeModal} icon={LineGeneralXClose.id} />
          </div>
        </div>
        <div className={styles["gallery-data"]}>
          <div className={styles["gallery-data-component"]} key={modalData.value?.data?.link?.id}>
            {modalData.value?.component}
          </div>
        </div>
      </div>

      <GalleryCarousel attachments={testResult.attachments} />
    </>
  );
};
