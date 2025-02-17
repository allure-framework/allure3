import type { AttachmentTestStepResult } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
import { JSXInternal } from "preact/src/jsx";
import * as styles from "./styles.scss";

import Element = JSXInternal.Element;

export interface ModalThumbProps {
  item: AttachmentTestStepResult;
  changeThumb?: () => void;
  children: Element;
  isActiveThumb?: boolean;
}

export const ModalThumb: FunctionalComponent<ModalThumbProps> = ({ changeThumb, children, isActiveThumb }) => {
  // const showAttach = (showedItem: AttachmentTestStepResult) => {
  //   openModal({
  //     data: showedItem,
  //     component: <Attachment item={showedItem} key={showedItem.link?.id} />,
  //   });
  // };

  return (
    <div
      className={`${styles["modal-thumb"]} ${isActiveThumb ? styles.active : ""}`}
      onClick={() => (changeThumb ? changeThumb() : () => {})}
    >
      {children}
    </div>
  );
};

export default ModalThumb;
