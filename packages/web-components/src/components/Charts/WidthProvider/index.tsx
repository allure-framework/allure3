import { useSignal } from "@preact/signals";
import type { ComponentChildren, FunctionalComponent } from "preact";
import { useEffect, useRef } from "preact/hooks";

export const WidthProvider: FunctionalComponent<{ children: (width: number) => ComponentChildren }> = (props) => {
  const widthSignal = useSignal<number>(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    widthSignal.value = ref.current.clientWidth;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        widthSignal.value = entry.target.clientWidth;
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [widthSignal]);

  return <div ref={ref}>{props.children(widthSignal.value)}</div>;
};
