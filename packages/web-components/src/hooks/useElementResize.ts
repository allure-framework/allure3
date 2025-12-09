import { useEffect, useRef } from "preact/hooks";

export const useElementResize = <T extends HTMLElement>(cb: (size: { width: number; height: number }) => void) => {
  const elRef = useRef<T | null>(null);
  const cbRef = useRef(cb);

  useEffect(() => {
    if (!elRef.current || !cbRef.current) {
      return;
    }

    const observer = new ResizeObserver(([{ contentRect }]) => {
      cbRef.current({ width: contentRect.width || 0, height: contentRect.height || 0 });
    });

    observer.observe(elRef.current);

    return () => observer.disconnect();
  }, []);

  return elRef;
};
