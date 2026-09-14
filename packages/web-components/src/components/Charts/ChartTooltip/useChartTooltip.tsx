import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import { createPortal } from "preact/compat";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Tooltip } from "../../Tooltip";

/** A tooltip shared by HTML and SVG chart targets, including keyboard interaction. */
export const useChartTooltip = (text: string, tooltipText = text) => {
  const id = useId();
  const [anchor, setAnchor] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
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
    setAnchor(event.currentTarget as Element);
    setOpen(true);
  };

  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;

    if (!open || !anchor || !tooltip) {
      return;
    }

    let active = true;
    const release = autoUpdate(anchor, tooltip, () => {
      void computePosition(anchor, tooltip, {
        strategy: "fixed",
        placement: "top",
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        if (active) {
          Object.assign(tooltip.style, { left: `${x}px`, top: `${y}px` });
        }
      });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        tooltipHovered.current = false;
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      active = false;
      release();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, anchor, text]);

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
