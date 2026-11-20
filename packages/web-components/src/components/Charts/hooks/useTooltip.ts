import type { Placement } from "@floating-ui/dom";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import { useCallback, useRef, useState } from "preact/hooks";

export const useTooltip = <D extends Record<string, any>>(placement?: Placement) => {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipData, setData] = useState<D | null>(null);
  const tooltipTargetRef = useRef<Element | null>(null);
  const autoUpdateRef = useRef<() => void>(() => {});

  const handleShowTooltip = useCallback(
    async (target: Element, data: D) => {
      if (!tooltipRef.current) {
        return;
      }

      // Tootlip is already shown for this target
      if (tooltipTargetRef.current === target) {
        return;
      }

      const updatePosition = () => {
        if (!tooltipRef.current) {
          return;
        }

        return computePosition(target, tooltipRef.current, {
          middleware: [offset(6), flip(), shift({ crossAxis: true, padding: 5 })],
          strategy: "fixed",
          placement,
        }).then(({ x, y, strategy }) => {
          if (!tooltipRef.current || tooltipTargetRef.current !== target) {
            return;
          }

          tooltipRef.current.style.position = strategy;
          tooltipRef.current.style.pointerEvents = `none`;
          tooltipRef.current.style.left = `${x}px`;
          tooltipRef.current.style.top = `${y}px`;
        });
      };

      autoUpdateRef.current();
      tooltipTargetRef.current = target;
      await updatePosition();
      if (tooltipTargetRef.current !== target || !tooltipRef.current) {
        return;
      }

      setIsVisible(true);
      setData(data);

      autoUpdateRef.current = autoUpdate(target, tooltipRef.current, updatePosition);
    },
    [placement],
  );

  const handleHideTooltip = useCallback((target?: Element) => {
    if (target && tooltipTargetRef.current !== target) {
      return;
    }

    autoUpdateRef.current();
    tooltipTargetRef.current = null;
    setIsVisible(false);
    setData(null);
  }, []);

  return {
    tooltipRef,
    isVisible,
    handleShowTooltip,
    handleHideTooltip,
    data: tooltipData,
  };
};
