import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { Button, Heading, IconButton, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { signal } from "@preact/signals";
import type { FunctionalComponent, VNode } from "preact";
import { useEffect } from "preact/hooks";
import Prism from "prismjs";
import type { AwesomeTestResult } from "types";
import { Attachment } from "@/components/TestResult/TestResultSteps/attachment";
import { attachmentType, downloadAttachment, openAttachmentInNewTab } from "@/utils/attachments";
import * as styles from "./styles.scss";

export const isModalOpen = signal(false);

interface ModalDataProps {
  data: AttachmentTestStepResult;
  component: VNode;
  preview?: boolean;
}

export const modalData = signal<ModalDataProps>({
  data: null,
  preview: false,
  component: null,
});

const openModal = ({ data, component, preview }: ModalDataProps) => {
  modalData.value = {
    data,
    component,
    preview,
  };
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const ModalThumb: FunctionalComponent<{ item: AttachmentTestStepResult }> = ({ item, children }) => {
  const isActiveThumb = modalData.value.data?.link?.id === item.link?.id;

  const showAttach = (showedItem: AttachmentTestStepResult) => {
    openModal({
      data: showedItem,
      component: <Attachment item={showedItem} key={showedItem.link?.id} />,
    });
  };

  return (
    <div className={`${styles["modal-thumb"]} ${isActiveThumb ? styles.active : ""}`} onClick={() => showAttach(item)}>
      {children}
    </div>
  );
};

export type ModalGalleryProps = {
  attachments: AttachmentTestStepResult[];
};

const ModalGallery: FunctionalComponent<ModalGalleryProps> = ({ attachments = [] }) => {
  const filteredAttachments = attachments.filter(({ link: { contentType } }: AttachmentTestStepResult) => {
    const type = attachmentType(contentType).type;

    return !["archive", null].includes(type as string);
  });

  return (
    <div className={styles["modal-gallery"]}>
      {filteredAttachments.map((item, index) => (
        <ModalThumb item={item} key={index}>
          <Attachment item={item} />
        </ModalThumb>
      ))}
    </div>
  );
};

export type ModalProps = {
  testResult: AwesomeTestResult;
};

const Modal: FunctionalComponent<ModalProps> = ({ testResult }) => {
  const { link } = modalData.value.data || {};
  const attachName = link?.name ? `${link?.name}` : `${link?.id}${link?.ext}`;

  useEffect(() => {
    Prism.highlightAll();

    if (isModalOpen.value) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

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

  if (!isModalOpen.value) {
    return null;
  }

  return (
    <div className={styles["modal-overlay"]} onClick={closeModal}>
      <div className={styles["modal-content"]} onClick={(e) => e.stopPropagation()}>
        <div className={`${styles["modal-wrapper"]}`}>
          <div className={styles["modal-top"]}>
            <Heading size={"s"}>{attachName}</Heading>
            <div className={styles["modal-buttons"]}>
              {isImageAttachment && (
                <Button
                  style={"outline"}
                  onClick={openInNewWindow}
                  icon={allureIcons.lineGeneralLinkExternal}
                  text={"Open in new tab"}
                />
              )}
              {isHtmlAttachment && (
                <TooltipWrapper tooltipText={"Preview attachment"}>
                  <IconButton
                    style={"outline"}
                    size={"m"}
                    iconSize={"s"}
                    icon={modalData.value.preview ? allureIcons.viewOff : allureIcons.view}
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
                  icon={allureIcons.lineGeneralDownloadCloud}
                  onClick={(e: MouseEvent) => downloadData(e)}
                />
              </TooltipWrapper>
              <IconButton iconSize={"m"} style={"ghost"} onClick={closeModal} icon={allureIcons.lineGeneralXClose} />
            </div>
          </div>
          <div className={styles["modal-data"]}>
            <div className={styles["modal-data-component"]} key={modalData.value?.data?.link?.id}>
              {modalData.value?.component}
            </div>
          </div>
        </div>
        <ModalGallery attachments={testResult.attachments} />
      </div>
    </div>
  );
};

export { openModal, closeModal };
export default Modal;
