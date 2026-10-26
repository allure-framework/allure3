import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { attachmentType, downloadAttachment, openAttachmentInNewTab } from "@allurereport/web-commons";
import { Attachment, Button, Heading, IconButton, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { signal } from "@preact/signals";
import type { FunctionalComponent, VNode } from "preact";
import { cloneElement } from "preact";
import { useEffect } from "preact/hooks";
import type { ReportTestResult } from "types";

import { hasAttachmentPreview } from "@/components/TestResult/TestResultSteps/attachmentPreview";
import { useAttachmentI18n } from "@/components/TestResult/TestResultSteps/useAttachmentI18n";
import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

export const isModalOpen = signal(false);

interface ModalDataProps {
  data: Partial<AttachmentTestStepResult> | Record<string, unknown>;
  component: VNode;
  preview?: boolean;
  title?: string;
}

export const modalData = signal<ModalDataProps>({
  data: null,
  preview: false,
  component: null,
});

const openModal = ({ data, component, preview, title }: ModalDataProps) => {
  modalData.value = {
    data,
    component,
    preview,
    title,
  };
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const getAttachmentLink = (data: ModalDataProps["data"]) =>
  (data as Partial<AttachmentTestStepResult> | null)?.link as AttachmentTestStepResult["link"] | undefined;

const ModalThumb: FunctionalComponent<{ item: AttachmentTestStepResult }> = ({ item, children }) => {
  const i18n = useAttachmentI18n();
  const isActiveThumb = getAttachmentLink(modalData.value.data)?.id === item.link?.id;

  const showAttach = (showedItem: AttachmentTestStepResult) => {
    openModal({
      data: showedItem,
      preview: hasAttachmentPreview(showedItem.link?.contentType),
      component: <Attachment item={showedItem} key={showedItem.link?.id} i18n={i18n} />,
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
    const type = attachmentType(contentType);

    return !["archive", null].includes(type);
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
  testResult: ReportTestResult;
};

const Modal: FunctionalComponent<ModalProps> = ({ testResult }) => {
  const { t } = useI18n("controls");
  const { data, component, preview, title } = modalData.value;
  const link = getAttachmentLink(data);
  const attachName = link?.name ? `${link?.name}` : link ? `${link?.id}${link?.ext}` : "";
  const isAttachment = Boolean(link?.id);

  useEffect(() => {
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
  const isPreviewToggleAttachment = hasAttachmentPreview(link?.contentType);
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
            <Heading size={"s"}>{title || attachName}</Heading>
            <div className={styles["modal-buttons"]}>
              {isImageAttachment && (
                <Button
                  style={"outline"}
                  onClick={openInNewWindow}
                  icon={allureIcons.lineGeneralLinkExternal}
                  text={t("openInNewTab")}
                />
              )}
              {isPreviewToggleAttachment && (
                <TooltipWrapper tooltipText={t("previewAttachment")}>
                  <IconButton
                    style={"outline"}
                    size={"m"}
                    iconSize={"s"}
                    icon={preview ? allureIcons.viewOff : allureIcons.view}
                    onClick={() => {
                      modalData.value = {
                        ...modalData.value,
                        preview: !preview,
                      };
                    }}
                  />
                </TooltipWrapper>
              )}
              {isAttachment && (
                <TooltipWrapper tooltipText={t("downloadAttachment")}>
                  <IconButton
                    style={"outline"}
                    size={"m"}
                    iconSize={"s"}
                    icon={allureIcons.lineGeneralDownloadCloud}
                    onClick={(e: MouseEvent) => downloadData(e)}
                  />
                </TooltipWrapper>
              )}
              <IconButton iconSize={"m"} style={"ghost"} onClick={closeModal} icon={allureIcons.lineGeneralXClose} />
            </div>
          </div>
          <div className={styles["modal-data"]}>
            <div className={styles["modal-data-component"]} key={link?.id ?? title}>
              {isAttachment && component ? cloneElement(component, { previewable: !!preview }) : component}
            </div>
          </div>
        </div>
        {isAttachment && <ModalGallery attachments={testResult.attachments} />}
      </div>
    </div>
  );
};

export { openModal, closeModal };
export default Modal;
