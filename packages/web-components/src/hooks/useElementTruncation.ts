import { useCallback, useEffect, useState } from "preact/hooks";

type UseElementTruncationOptions = {
  observeResize?: boolean;
};

const isElementTruncated = (element: HTMLElement) => {
  const isElementOverflowing = element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
  const parentElement = element.parentElement;
  const isParentOverflowing =
    !!parentElement &&
    (parentElement.scrollWidth > parentElement.clientWidth || parentElement.scrollHeight > parentElement.clientHeight);

  return isElementOverflowing || isParentOverflowing;
};

export const useElementTruncation = <T extends HTMLElement>(
  dependencies: ReadonlyArray<unknown>,
  options: UseElementTruncationOptions = {},
) => {
  const { observeResize = true } = options;
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
      setIsTruncated(isElementTruncated(element));
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
  }, [element, observeResize, ...dependencies]);

  return {
    ref: elementRef,
    isTruncated,
  };
};
