import type { FunctionalComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useDebounce } from "use-debounce";
import { WidthProvider } from "./context.js";

const noop = () => {};

const InnerResponsiveWrapper: FunctionalComponent<{
  width: number;
  onResize?: (width: number) => void;
  debounceResize?: number;
}> = (props) => {
  const { children, width, onResize, debounceResize = 0 } = props;

  const [debouncedWidth] = useDebounce(width, debounceResize);

  useEffect(() => {
    onResize?.(debouncedWidth);
  }, [debouncedWidth, onResize]);

  // We wait for width to be calculated
  if (debouncedWidth > 0) {
    return <WidthProvider width={debouncedWidth}>{children}</WidthProvider>;
  }

  return null;
};

export const ResponsiveWrapper: FunctionalComponent<{
  defaultWidth?: number;
  onResize?: (width: number) => void;
  debounceResize?: number;
}> = (props) => {
  const { children, defaultWidth = 0, onResize = noop, debounceResize = 0 } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(defaultWidth);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    setWidth(ref.current.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.target.clientWidth);
      }
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [defaultWidth]);

  return (
    <div ref={ref}>
      <InnerResponsiveWrapper width={width} onResize={onResize} debounceResize={debounceResize}>
        {children}
      </InnerResponsiveWrapper>
    </div>
  );
};
