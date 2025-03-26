import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";
import Sortable, { Swap } from "sortablejs";
import type { Options } from "sortablejs";
import { DEFAULT_ANIMATION_DURATION, DEFAULT_DRAG_ENABLED_CLASSNAME, DEFAULT_HANDLE_CLASSNAME } from "../constants";

// Mount the Swap plugin to enable swap animation functionality.
// This is required for the swap option to work in the Grid component.
Sortable.mount(new Swap());

/**
 * Integrates SortableJS with a container element.
 *
 * @param ref - A reference to the container element.
 * @param options - The SortableJS options.
 */
export const useSortable = (ref: RefObject<HTMLElement>, options?: Options): void => {
  useEffect(() => {
    if (ref.current) {
      const sortable = Sortable.create(ref.current, {
        animation: DEFAULT_ANIMATION_DURATION, // Animation duration in milliseconds for drag and drop transitions
        handle: `.${DEFAULT_HANDLE_CLASSNAME}`, // Selector for drag handle element that initiates dragging
        draggable: `.${DEFAULT_DRAG_ENABLED_CLASSNAME}`, // Selector for elements that should be draggable
        ...options,
      });

      return () => {
        sortable.destroy();
      };
    }
  }, [ref, options]);
};
