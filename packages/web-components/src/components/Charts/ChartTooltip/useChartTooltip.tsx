import { autoUpdate, computePosition, flip, offset, shift, size } from "@floating-ui/dom";
import type { RefObject } from "preact";
import { createPortal } from "preact/compat";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Tooltip } from "../../Tooltip";

/** A tooltip shared by HTML and SVG chart targets, including keyboard interaction. */
export const useChartTooltip = (
  text: string,
  tooltipText = text,
  { followPointer = false, boundary }: { followPointer?: boolean; boundary?: RefObject<Element> } = {},
) => {
  const id = useId();
  const [anchor, setAnchor] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const updatePosition = useRef<() => void>();
  const focused = useRef(false);
  const hovered = useRef(false);
  const tooltipHovered = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const cancelHide = () => clearTimeout(hideTimer.current);
  const hideAfterLeave = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => {
      if (!focused.current && !hovered.current && !tooltipHovered.current) setOpen(false);
    }, 100);
  };
  const show = (event: Event) => {
    cancelHide();
    pointer.current = followPointer && event instanceof MouseEvent ? { x: event.clientX, y: event.clientY } : null;
    setAnchor((followPointer ? event.target : event.currentTarget) as Element);
    setOpen(true);
    if (followPointer) updatePosition.current?.();
  };

  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useEffect(() => {
    if (!text) setOpen(false);
  }, [text]);
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;

    if (!open || !anchor || !tooltip) {
      return;
    }

    let active = true;
    const overflow = boundary ? { boundary: boundary.current ?? undefined, padding: 8 } : undefined;
    const reference = followPointer
      ? {
          contextElement: anchor,
          getBoundingClientRect: () => {
            const point = pointer.current;
            return point ? new DOMRect(point.x, point.y, 0, 0) : anchor.getBoundingClientRect();
          },
        }
      : anchor;
    const update = () => {
      void computePosition(reference, tooltip, {
        strategy: "fixed",
        placement: pointer.current ? "right" : "top",
        middleware: [
          offset(8),
          flip(overflow),
          shift({ ...overflow, padding: 8 }),
          ...(boundary
            ? [
                size({
                  ...overflow,
                  apply: ({ availableWidth, availableHeight }) => {
                    tooltip.style.setProperty("--tooltip-max-width", `${Math.max(0, availableWidth)}px`);
                    tooltip.style.maxHeight = `${Math.max(0, availableHeight)}px`;
                    tooltip.style.overflow = "auto";
                  },
                }),
              ]
            : []),
        ],
      }).then(({ x, y }) => {
        if (active) {
          Object.assign(tooltip.style, { left: `${x}px`, top: `${y}px` });
        }
      });
    };
    updatePosition.current = update;
    const release = autoUpdate(anchor, tooltip, update);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        tooltipHovered.current = false;
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      active = false;
      updatePosition.current = undefined;
      release();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, anchor, text, followPointer, boundary]);

  return {
    triggerProps: {
      // SVG attribute names are case-sensitive; lowercase also works for HTML targets.
      "tabindex": 0,
      "data-chart-tooltip-trigger": true,
      "aria-describedby": id,
      "onMouseEnter": (event: MouseEvent) => {
        hovered.current = true;
        show(event);
      },
      "onMouseLeave": () => {
        hovered.current = false;
        hideAfterLeave();
      },
      "onFocus": (event: FocusEvent) => {
        focused.current = true;
        show(event);
      },
      "onBlur": () => {
        focused.current = false;
        hideAfterLeave();
      },
    },
    tooltip: text
      ? createPortal(
          <>
            <span
              id={id}
              style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}
            >
              {text}
            </span>
            {open && (
              <div
                ref={tooltipRef}
                role="tooltip"
                data-chart-tooltip
                style={{ position: "fixed", zIndex: 1000 }}
                onMouseEnter={() => {
                  tooltipHovered.current = true;
                  cancelHide();
                }}
                onMouseLeave={() => {
                  tooltipHovered.current = false;
                  hideAfterLeave();
                }}
              >
                <Tooltip>{tooltipText}</Tooltip>
              </div>
            )}
          </>,
          document.body,
        )
      : null,
  };
};
