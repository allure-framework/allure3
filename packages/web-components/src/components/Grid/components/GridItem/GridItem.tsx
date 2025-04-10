import { clsx } from "clsx";
import type { FunctionComponent } from "preact";
import type { HTMLAttributes } from "preact/compat";
import { DEFAULT_DRAG_ENABLED_CLASSNAME } from "../../constants";
import { DragHandle } from "./components";
import styles from "./styles.scss";

export interface GridItemProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Additional class names to be applied to the container.
   */
  className?: string;

  /**
   * Enable drag and drop functionality for this item.
   */
  dndEnabled?: boolean;
}

/**
 * GridItem component that represents a single item within the Grid layout.
 *
 * @property children - The elements rendered inside the grid item.
 * @property className - Additional CSS classes to apply to the container.
 * @property dndEnabled - Enables drag and drop functionality for this item.
 */
export const GridItem: FunctionComponent<GridItemProps> = ({
  className,
  children,
  dndEnabled = false,
  ...restProps
}) => (
  <div
    {...restProps}
    className={clsx(styles["grid-item"], { [DEFAULT_DRAG_ENABLED_CLASSNAME]: dndEnabled }, className)}
  >
    <div className={styles["grid-item-content"]}>{children}</div>
    {dndEnabled && <DragHandle className={styles["grid-item-handle"]} />}
  </div>
);
