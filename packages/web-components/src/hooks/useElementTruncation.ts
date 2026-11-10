import { useCallback, useEffect, useState } from "preact/hooks";

type UseElementTruncationOptions = {
  observeResize?: boolean;
  axis?: "horizontal" | "vertical" | "both";
};

// Sibling content (such as a rotating dropdown icon) can overflow the parent
// without truncating the observed element.
const isElementTruncated = (element: HTMLElement, axis: NonNullable<UseElementTruncationOptions["axis"]>) =>
  (axis !== "vertical" && element.scrollWidth > element.clientWidth) ||
  (axis !== "horizontal" && element.scrollHeight > element.clientHeight);

export const useElementTruncation = <T extends HTMLElement>(
  dependencies: ReadonlyArray<unknown>,
  options: UseElementTruncationOptions = {},
) => {
  const { observeResize = true, axis = "both" } = options;
  const [element, setElement] = useState<T | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const elementRef = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) {
      return;
    }

    const parentElement = element.parentElement;
    const syncTruncation = () => {
      setIsTruncated(isElementTruncated(element, axis));
    };

    syncTruncation();
    const frame = requestAnimationFrame(syncTruncation);
    void document.fonts?.ready.then(syncTruncation);

    if (!observeResize) {
      return () => cancelAnimationFrame(frame);
    }

    const syncOnWindowResize = () => {
      syncTruncation();
    };
    window.addEventListener("resize", syncOnWindowResize);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", syncOnWindowResize);
      };
    }

    const observer = new ResizeObserver(syncTruncation);
    observer.observe(element);
    if (parentElement) {
      observer.observe(parentElement);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncOnWindowResize);
      observer.disconnect();
    };
  }, [element, observeResize, axis, ...dependencies]);

  return {
    ref: elementRef,
    isTruncated,
  };
};
