import type { FunctionComponent, ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { clsx } from "clsx";
import type { Options } from "sortablejs";
import type { ClassValue } from "clsx";
import { useSortable } from "./hooks";
import styles from "./Grid.module.scss";

export interface GridProps {
  /**
   * Child elements to render within the layout.
   */
  children: ComponentChildren;

  /**
   * Options to configure SortableJS behavior.
   */
  options?: Options;

  /**
   * Additional class names to be applied to the container.
   */
  className?: string;
}

/**
 * Grid component that provides an abstract layer for drag-and-drop sorting.
 *
 * @property children - The elements rendered inside the layout.
 * @property options - Configuration options for drag-and-drop behavior.
 * @property className - Additional CSS classes to apply to the container.
 */
export const Grid: FunctionComponent<GridProps> = ({
  className,
  options,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize the sortable hook with the provided options.
  useSortable(containerRef, options);

  return (
    <div ref={containerRef} className={clsx(styles.layout, className)} children={children} />
  );
};
