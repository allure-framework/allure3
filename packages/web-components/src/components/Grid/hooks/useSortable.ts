import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";
import Sortable from "sortablejs";
import type { Options } from "sortablejs";

/**
 * Integrates SortableJS with a container element.
 *
 * @param ref - A reference to the container element.
 * @param options - The SortableJS options.
 */
export const useSortable = (
  ref: RefObject<HTMLElement>,
  options?: Options
): void => {
  useEffect(() => {
    if (ref.current) {
      const sortable = Sortable.create(ref.current, {
        animation: 150,
        ...options
      });

      return () => {
        sortable.destroy();
      };
    }
  }, [ref, options]);
};
