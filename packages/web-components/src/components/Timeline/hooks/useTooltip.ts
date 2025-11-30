import type { Placement } from "@floating-ui/dom";
import { autoUpdate, computePosition, flip, offset } from "@floating-ui/dom";
import { useCallback, useRef, useState } from "preact/hooks";

export const useTooltip = <D extends Record<string, any>>(placement?: Placement) => {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipData, setData] = useState<D>({} as D);
  const tooltipTargetRef = useRef<HTMLElement | null>(null);
  const autoUpdateRef = useRef<() => void>(() => {});

  const handleShowTooltip = useCallback(
    (target: HTMLElement, data: D) => {
      if (!tooltipRef.current) {
        return;
      }

      setIsVisible(true);
      setData(data);

      const updatePosition = () => {
        if (!tooltipRef.current) {
          return;
        }

        computePosition(target, tooltipRef.current, {
          middleware: [flip(), offset(6)],
          strategy: "fixed",
          placement,
        }).then(({ x, y, strategy }) => {
          if (!tooltipRef.current) {
            return;
          }

          tooltipTargetRef.current = target;

          tooltipRef.current.style.left = `${x}px`;
          tooltipRef.current.style.top = `${y}px`;
          tooltipRef.current.style.position = strategy;
        });
      };

      autoUpdateRef.current = autoUpdate(target, tooltipRef.current, updatePosition);
    },
    [placement],
  );

  const handleHideTooltip = useCallback((target: HTMLElement) => {
    if (tooltipTargetRef.current !== target) {
      return;
    }

    autoUpdateRef.current();
    setIsVisible(false);
    setData({} as D);
  }, []);

  return {
    tooltipRef,
    isVisible,
    handleShowTooltip,
    handleHideTooltip,
    data: tooltipData,
  };
};
