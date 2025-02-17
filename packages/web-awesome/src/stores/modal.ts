import type { ModalDataProps } from "@allurereport/web-components";
import { signal } from "@preact/signals";

export const isModalOpen = signal(false);

export const modalData = signal<ModalDataProps>({
  data: null,
  preview: false,
  component: null,
  isModalOpen: false,
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
