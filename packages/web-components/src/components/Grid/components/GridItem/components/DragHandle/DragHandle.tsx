import { clsx } from "clsx";
import type { FunctionComponent } from "preact";
import styles from "./styles.scss";
import { DragHandleIcon } from "./components";
import { DEFAULT_HANDLE_CLASSNAME } from "../../../../constants";

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
