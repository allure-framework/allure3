import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";
import Sortable, { Swap } from "sortablejs";
import type { Options } from "sortablejs";

// Mount the Swap plugin to enable swap animation functionality.
// This is required for the swap option to work in the Grid component.
Sortable.mount(new Swap());

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
        animation: 150, // Animation duration in milliseconds for drag and drop transitions
        handle: ".dnd-drag-handle", // Selector for drag handle element that initiates dragging
        draggable: ".dnd-drag-enabled", // Selector for elements that should be draggable
        ...options,
      });

      return () => {
        sortable.destroy();
      };
    }
  }, [ref, options]);
};
