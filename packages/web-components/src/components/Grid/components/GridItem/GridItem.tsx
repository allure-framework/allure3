import { clsx } from "clsx";
import type { ComponentChildren, FunctionComponent } from "preact";
import type { HTMLAttributes } from "preact/compat";
import styles from "./GridItem.module.scss";
import { DragHandle } from "./components";

export interface GridItemProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Child elements to render within the grid item.
   */
  children: ComponentChildren;

  /**
   * Additional class names to be applied to the container.
   */
  className?: string;

  /**
   * Disable drag and drop functionality for this item.
   */
  isDndDisabled?: boolean;
}

/**
 * GridItem component that represents a single item within the Grid layout.
 *
 * @property children - The elements rendered inside the grid item.
 * @property className - Additional CSS classes to apply to the container.
 * @property isDndDisabled - When true, disables drag and drop functionality for this item.
 */
export const GridItem: FunctionComponent<GridItemProps> = ({
  className,
  children,
  isDndDisabled = false,
  ...restProps
}) => {
  const isDndEnabled = !isDndDisabled;

  return (
    <div className={clsx(styles["grid-item"], { "dnd-drag-enabled": isDndEnabled }, className)} {...restProps}>
      <div className={styles["grid-item-content"]}>{children}</div>
      {isDndEnabled && <DragHandle className={styles["grid-item-handle"]} />}
    </div>
  );
};
