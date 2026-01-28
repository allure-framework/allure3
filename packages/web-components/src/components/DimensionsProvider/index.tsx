import { batch, useSignal } from "@preact/signals";
import { debounce } from "lodash";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

type Props = {
  children: (width: number, height: number) => ComponentChildren;
  debounceTimeout?: number;
};

export const DimensionsProvider = (props: Props) => {
  const { debounceTimeout = 0, children } = props;
  const ref = useRef<HTMLDivElement>(null);
  const width = useSignal<number>(ref.current?.clientWidth ?? 0);
  const height = useSignal<number>(ref.current?.clientHeight ?? 0);
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

      batch(() => {
        const newWidth = Math.floor(el.clientWidth);
        const newHeight = Math.floor(el.clientHeight);

        if (newWidth !== width.peek()) {
          width.value = newWidth;
        }

        if (newHeight !== height.peek()) {
          height.value = newHeight;
        }
      });
    }, debounceTimeout);

    updateWidth(ref.current);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateWidth(entry.target);
      }
    });

    observer.observe(ref.current);

    const handleWindowResize = () => {
      if (!ref.current) {
        return;
      }

      updateWidth(ref.current);
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [debounceTimeout, width, height]);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      {children(width.value, height.value)}
    </div>
  );
};
