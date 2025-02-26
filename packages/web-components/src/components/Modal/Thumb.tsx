import type { AttachmentTestStepResult } from "@allurereport/core-api";
import cx from "clsx";
import type { FunctionalComponent } from "preact";
import styles from "./styles.scss";

export interface ModalThumbProps {
  item: AttachmentTestStepResult;
  changeThumb?: () => void;
  isActiveThumb?: boolean;
}

export const ModalThumb: FunctionalComponent<ModalThumbProps> = ({ changeThumb, children, isActiveThumb }) => {
  return (
    <div
      className={cx(styles["modal-thumb"], { [styles.active]: isActiveThumb })}
      onClick={() => () => changeThumb?.()}
    >
      {children}
    </div>
  );
};

export default ModalThumb;
