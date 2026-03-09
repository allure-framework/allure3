import type { AttachmentLinkExpected, AttachmentTestStepResult } from "@allurereport/core-api";
import {
  downloadAttachment,
  isPreviewableContentType,
  isSyntaxHighlightSupported,
  openAttachmentInNewTab,
} from "@allurereport/web-commons";
import { clsx } from "clsx";
import type { VNode } from "preact";
import { cloneElement } from "preact/compat";
import { useEffect, useMemo, useState } from "preact/hooks";

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
  data?: T;
  component: VNode;
  preview?: boolean;
  isModalOpen?: boolean;
  closeModal?: () => void;
  attachments?: AttachmentTestStepResult[];
  title?: string;
}

export interface ModalTranslations {
  tooltipPreview: string;
  tooltipSyntaxHighlight?: string;
  tooltipDownload: string;
  openInNewTabButton: string;
}

export interface ModalTranslationsProps {
  translations: ModalTranslations;
}

export const Modal = ({
  data,
  isModalOpen,
  preview: initialPreview,
  component,
  attachments,
  closeModal,
  translations,
  title,
}: ModalDataProps & ModalTranslationsProps) => {
  const { tooltipPreview, tooltipSyntaxHighlight, tooltipDownload, openInNewTabButton } = translations;
  const { link } = data || {};
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [preview, setPreview] = useState(!!initialPreview);
  const [highlightCode, setHighlightCode] = useState(true);

  const isImageAttachment = link?.contentType?.startsWith("image");
  const isPreviewableAttachment = isPreviewableContentType(link?.contentType);
  const isCodeView =
    !isImageAttachment && !link?.contentType?.startsWith("video") && (isPreviewableAttachment ? !preview : true);
  const isSyntaxHighlightable = isSyntaxHighlightSupported({
    contentType: link?.contentType,
    ext: link?.ext,
    name: link?.name,
    originalFileName: link?.originalFileName,
  });
  const isAttachment = link?.id && link?.ext && link?.contentType;
  const attachmentName = link?.name || (link?.id && link?.ext && `${link.id}${link.ext}`) || "";
  const modalName = title || attachmentName;

  useEffect(() => {
    if (isModalOpen) {
      setPreview(!!initialPreview);
      setHighlightCode(true);
    }
  }, [isModalOpen, initialPreview]);

  const WrappedComponent = useMemo(() => {
    return (
      component &&
      cloneElement(component, {
        data,
        isFullScreen,
        previewable: preview,
        highlightCode,
      })
    );
  }, [component, data, isFullScreen, preview, highlightCode]);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

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
      <div className={clsx(styles["modal-content"])} onClick={(e) => e.stopPropagation()}>
        <div className={clsx(styles["modal-wrapper"], { [styles["modal-wrapper-fullscreen"]]: isFullScreen })}>
          <div className={styles["modal-header"]}>
            <Heading size={"s"}>{modalName}</Heading>
            <div className={styles["modal-buttons"]}>
              {isImageAttachment && (
                <Button
                  style={"outline"}
                  onClick={openInNewWindow}
                  icon={allureIcons.lineGeneralLinkExternal}
                  text={openInNewTabButton}
                />
              )}
              {isPreviewableAttachment && (
                <TooltipWrapper tooltipText={tooltipPreview}>
                  <IconButton
                    style={"outline"}
                    size={"m"}
                    iconSize={"s"}
                    icon={preview ? allureIcons.viewOff : allureIcons.view}
                    onClick={() => setPreview(!preview)}
                  />
                </TooltipWrapper>
              )}
              {isCodeView && isSyntaxHighlightable && (
                <TooltipWrapper tooltipText={tooltipSyntaxHighlight ?? "Syntax highlighting"}>
                  <IconButton
                    className={clsx(!highlightCode && styles["syntax-highlight-off"])}
                    style={"outline"}
                    size={"m"}
                    iconSize={"s"}
                    icon={allureIcons.lineDevCodeSquare}
                    onClick={() => setHighlightCode(!highlightCode)}
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
              <IconButton
                iconSize={"m"}
                style={"ghost"}
                onClick={() => setIsFullScreen(!isFullScreen)}
                icon={isFullScreen ? allureIcons.lineLayoutsMinimize2 : allureIcons.lineLayoutsMaximize2}
              />
              <IconButton iconSize={"m"} style={"ghost"} onClick={closeModal} icon={allureIcons.lineGeneralXClose} />
            </div>
          </div>
          <div className={styles["modal-data"]}>
            <div className={styles["modal-data-component"]} key={data?.link?.id}>
              {WrappedComponent}
            </div>
          </div>
        </div>
        {attachments?.length && <Gallery attachments={attachments} />}
      </div>
    </div>
  );
};
