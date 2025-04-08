import { clsx } from "clsx";
import type { FunctionComponent } from "preact";
import { DEFAULT_HANDLE_CLASSNAME } from "../../../../constants";
import { DragHandleIcon } from "./components";
import styles from "./styles.scss";

export interface DragHandleProps {
  className?: string;
}

export const DragHandle: FunctionComponent<DragHandleProps> = ({ className }) => {
  return (
    <div className={clsx(styles["drag-handle"], DEFAULT_HANDLE_CLASSNAME, className)}>
      <DragHandleIcon />
    </div>
  );
};
