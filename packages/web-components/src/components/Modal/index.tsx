import type { AttachmentLinkExpected, AttachmentTestStepResult } from "@allurereport/core-api";
import { downloadAttachment, openAttachmentInNewTab } from "@allurereport/web-commons";
import type { VNode } from "preact";
import { useEffect } from "preact/hooks";
import Prism from "prismjs";
import { Button, IconButton } from "@/components/Button";
import Gallery from "@/components/Modal/Gallery";
import { allureIcons } from "@/components/SvgIcon";
import { TooltipWrapper } from "@/components/Tooltip";
import { Heading } from "@/components/Typography";
import styles from "./styles.scss";

export type ModalGalleryProps = {
  attachments: AttachmentTestStepResult[] | undefined;
};

export interface ModalDataProps<T = any> {
  data: T;
  component: VNode;
  preview?: boolean;
  isModalOpen?: boolean;
  closeModal?: () => void;
  attachments?: AttachmentTestStepResult[];
}

export interface ModalTranslations {
  tooltipPreview: string;
  tooltipDownload: string;
  openInNewTabButton: string;
}

export interface ModalTranslationsProps {
  translations: ModalTranslations;
}

export const Modal = ({
  data,
  isModalOpen,
  preview,
  component,
  attachments,
  closeModal,
  translations,
}: ModalDataProps & ModalTranslationsProps) => {
  const { tooltipPreview, tooltipDownload, openInNewTabButton } = translations;
  const { link } = data || {};
  const attachName = link?.name ? `${link?.name}` : link?.id && link?.ext ? `${link?.id}${link?.ext}` : "";

  useEffect(() => {
    Prism.highlightAll();

    if (isModalOpen) {
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
  const isAttachment = link?.id && link?.ext && link?.contentType;

  const downloadData = async (e: Event) => {
    e.stopPropagation();
    const { id, ext, contentType } = link || {};
    if (id && ext && contentType) {
      await downloadAttachment(id, ext, contentType);
    }
  };

  const openInNewWindow = async () => {
    const { id, ext, contentType } = (link as AttachmentLinkExpected) || {};
    await openAttachmentInNewTab(id, ext, contentType as string);
  };

  if (!isModalOpen) {
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
                  text={openInNewTabButton}
                />
              )}
              {isHtmlAttachment && (
                <TooltipWrapper tooltipText={tooltipPreview}>
                  <IconButton
                    style={"outline"}
                    size={"m"}
                    iconSize={"s"}
                    icon={preview ? allureIcons.viewOff : allureIcons.view}
                  />
                </TooltipWrapper>
              )}
              {isAttachment && (
                <TooltipWrapper tooltipText={tooltipDownload}>
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
            <div className={styles["modal-data-component"]} key={data?.link?.id}>
              {component}
            </div>
          </div>
        </div>
        <Gallery attachments={attachments} />
      </div>
    </div>
  );
};
