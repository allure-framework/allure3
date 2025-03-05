import type { ModalDataProps } from "@allurereport/web-components";
import { signal } from "@preact/signals";

export const isModalOpen = signal(false);

export const modalData = signal<ModalDataProps>({
  data: null,
  preview: false,
  component: null,
  isModalOpen: isModalOpen.value,
  closeModal: null,
  title: "",
});

export const openModal = (props: ModalDataProps) => {
  modalData.value = { ...props };
  isModalOpen.value = true;
};

export const closeModal = () => {
  isModalOpen.value = false;
};
