import type { AttachmentTestStepResult } from "@allurereport/core-api";
import { signal } from "@preact/signals";
import type { FunctionalComponent, VNode } from "preact";
import { useEffect } from "preact/hooks";
import type { AllureAwesomeTestResult } from "types";
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

const Modal: FunctionalComponent = () => {
  useEffect(() => {
    if (isModalOpen.value) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen.value]);

  if (!isModalOpen.value) {
    return null;
  }

  return (
    <div className={styles["modal-overlay"]} onClick={closeModal}>
      <div className={styles["modal-content"]} onClick={(e) => e.stopPropagation()}>
        {modalData.value.component}
      </div>
    </div>
  );
};

export { openModal, closeModal };

export default Modal;
