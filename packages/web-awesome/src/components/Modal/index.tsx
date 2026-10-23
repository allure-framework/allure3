import { Modal, type ModalTranslations } from "@allurereport/web-components/core";

import { useI18n } from "@/stores";
import { isModalOpen, modalData } from "@/stores/modal";

export const ModalComponent = () => {
  const { t } = useI18n("controls");
  const { t: tErrors } = useI18n("errors");

  const translations: ModalTranslations = {
    tooltipDownload: modalData.value.data?.link?.missed ? tErrors("missedAttachment") : t("downloadAttachment"),
    tooltipPreview: t("previewAttachment"),
    tooltipSyntaxHighlight: t("syntaxHighlight"),
    openInNewTabButton: t("openInNewTab"),
  };

  return (
    <Modal
      {...modalData.value}
      translations={translations}
      isModalOpen={isModalOpen.value}
      closeModal={() => (isModalOpen.value = false)}
    />
  );
};
