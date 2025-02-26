import { Modal, type ModalTranslations } from "@allurereport/web-components";
import { useI18n } from "@/stores";
import { isModalOpen, modalData } from "@/stores/modal";

export const ModalComponent = () => {
  const { t } = useI18n("controls");

  const translations: ModalTranslations = {
    tooltipDownload: t("downloadAttachment"),
    tooltipPreview: t("previewAttachment"),
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
