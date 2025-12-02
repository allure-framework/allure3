import { debounce } from "lodash";
import type { ComponentChildren, FunctionalComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

export const WidthProvider: FunctionalComponent<{
  children: (width: number) => ComponentChildren;
  debounceTimeout?: number;
}> = (props) => {
  const { debounceTimeout = 0, children } = props;
  const [width, setWidth] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const updateWidth = debounce((el: Element) => {
      if (!isMounted.current) {
        return;
      }

      setWidth(el.clientWidth);
    }, debounceTimeout);

    updateWidth(ref.current);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateWidth(entry.target);
      }
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [debounceTimeout]);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      {children(width)}
    </div>
  );
};
