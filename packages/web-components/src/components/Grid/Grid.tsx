import type { FunctionComponent, ComponentChildren } from "preact";
import { useMemo, useRef } from "preact/hooks";
import { clsx } from "clsx";
import type { Options } from "sortablejs";
import { useSortable } from "./hooks";
import styles from "./Grid.module.scss";
import type { HTMLAttributes } from "preact/compat";

export type GridKind = "default" | "swap";

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Child elements to render within the layout.
   */
  children: ComponentChildren;

  /**
   * Options to configure SortableJS behavior.
   */
  options?: Options;

  /**
   * The kind of grid to render.
   */
  kind?: GridKind;

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
 * @property kind - The kind of grid to render.
 * @property className - Additional CSS classes to apply to the container.
 */
export const Grid: FunctionComponent<GridProps> = ({
  className,
  options,
  kind = "default",
  children,
  ...restProps
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const sortableOptions = useMemo(() => {
    return {
      ...options,
      ...(kind === "swap" && {
        swap: true, // Enable swap mode for more natural item reordering
        swapClass: "dnd-drag-swap-highlight", // Class applied to highlight items during swap
      }),
    };
  }, [options, kind]);

  // Initialize the sortable hook with the provided options.
  useSortable(containerRef, sortableOptions);

  return (
    <div ref={containerRef} className={clsx(styles.grid, className)} {...restProps}>
      {children}
    </div>
  );
};
