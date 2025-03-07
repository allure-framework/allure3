import type { FunctionComponent } from "preact";
import { clsx } from "clsx";
import styles from "./DragHandle.module.scss";
import { DragHandleIcon } from "./components";

export interface DragHandleProps {
  className?: string;
}

export const DragHandle: FunctionComponent<DragHandleProps> = ({ className }) => {
  return (
    <div className={clsx(styles.dragHandle, "dnd-drag-handle", className)}>
      <DragHandleIcon />
    </div>
  );
};
