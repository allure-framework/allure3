import type { ModalDataProps } from "@allurereport/web-components";
import { signal } from "@preact/signals";
import { useI18n } from "@/stores/locale";

export const isModalOpen = signal(false);

export const modalData = signal<ModalDataProps>({
  data: null,
  preview: false,
  component: null,
  isModalOpen: isModalOpen.value,
  closeModal: null,
});

export const openModal = ({ data, component, preview }: ModalDataProps) => {
  modalData.value = {
    data,
    component,
    preview,
  };
  isModalOpen.value = true;
};

export const closeModal = () => {
  isModalOpen.value = false;
};
