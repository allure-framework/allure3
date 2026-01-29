import type { Placement } from "@floating-ui/dom";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { FunctionalComponent, VNode } from "preact";
import type { MutableRefObject } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { Text } from "@/components/Typography";
import styles from "./styles.scss";

interface TooltipWrapperProps {
  "tooltipText"?: string;
  "tooltipTextAfterClick"?: string;
  "tooltipComponent"?: FunctionalComponent | VNode;
  "children": VNode;
  "placement"?: "top" | "bottom" | "left" | "right";
  "triggerMode"?: "hover" | "click";
  "autoHideDelay"?: number;
  "isTriggerActive"?: boolean;
  "data-testid"?: string;
  "showDelay"?: number;
}

interface TooltipProps {
  "data-testid"?: string;
}

export const Tooltip: FunctionalComponent<TooltipProps> = ({ children, "data-testid": dataTestId }) => (
  <div className={styles["custom-tooltip"]} data-testid={dataTestId}>
    <Text className="tooltip-content" size={"s"} bold>
      {children}
    </Text>
  </div>
);

export const useTooltip = <
  TriggerRef extends HTMLElement = HTMLElement,
  TooltipRef extends HTMLElement = HTMLElement,
>(props: {
  placement?: Placement;
  isVisible: boolean;
  triggerRef: MutableRefObject<TriggerRef>;
  tooltipRef: MutableRefObject<TooltipRef>;
}) => {
  const { placement = "top", triggerRef: triggerRefProp, tooltipRef: tooltipRefProp, isVisible } = props;
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLElement>(null);

  useEffect(() => {
    triggerRef.current = triggerRefProp.current;
    tooltipRef.current = tooltipRefProp.current;
  }, [triggerRefProp, tooltipRefProp]);

  useEffect(() => {
    const updatePosition = () => {
      if (triggerRef.current && tooltipRef.current) {
        computePosition(triggerRef.current, tooltipRef.current, {
          placement,
          middleware: [offset(6), flip(), shift({ padding: 5 })],
        }).then(({ x, y }) => {
          if (tooltipRef.current) {
            Object.assign(tooltipRef.current.style, {
              "left": `${x}px`,
              "top": `${y}px`,
              "position": "absolute",
              "z-index": 100,
            });
          }
        });
      }
    };

    const cleanup = () => {
      if (triggerRef.current && tooltipRef.current) {
        autoUpdate(triggerRef.current, tooltipRef.current, updatePosition);
      }
    };

    if (isVisible) {
      updatePosition();
    }

    return cleanup();
  }, [isVisible, placement]);
};

export const TooltipWrapper: FunctionalComponent<TooltipWrapperProps> = ({
  tooltipText,
  tooltipTextAfterClick,
  tooltipComponent,
  children,
  placement = "top",
  triggerMode = "hover",
  autoHideDelay = 600,
  showDelay = 200,
  isTriggerActive = true,
  "data-testid": dataTestId,
}) => {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentText, setCurrentText] = useState(tooltipText);
  const hideTimer = useRef<number | null>(null);
  const showTimer = useRef<number | null>(null);

  useEffect(() => {
    setCurrentText(tooltipText);
    const updatePosition = () => {
      if (triggerRef.current && tooltipRef.current) {
        computePosition(triggerRef.current, tooltipRef.current, {
          placement,
          middleware: [offset(6), flip(), shift({ padding: 5 })],
        }).then(({ x, y }) => {
          if (tooltipRef.current) {
            Object.assign(tooltipRef.current.style, {
              "left": `${x}px`,
              "top": `${y}px`,
              "position": "absolute",
              "z-index": 100,
            });
          }
        });
      }
    };

    const cleanup = () =>
      triggerRef.current && tooltipRef.current
        ? autoUpdate(triggerRef.current, tooltipRef.current, updatePosition)
        : () => {};

    if (isVisible) {
      updatePosition();
    }

    return cleanup();
  }, [isVisible, placement, tooltipText]);

  const onMouseEnter = () => {
    if (triggerMode === "hover" && isTriggerActive) {
      showTimer.current = window.setTimeout(() => {
        setIsVisible(true);
      }, showDelay);
    }

    if (triggerMode === "click" && hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
  };

  const onMouseLeave = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
    }
    if (triggerMode === "hover") {
      setIsVisible(false);
      setCurrentText(tooltipText);
    } else if (triggerMode === "click" && isVisible) {
      hideTimer.current = window.setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);
    }
  };

  const onClick = () => {
    if (triggerMode === "click") {
      if (triggerRef.current && isTriggerActive) {
        setIsVisible(true);
        if (hideTimer.current) {
          clearTimeout(hideTimer.current);
        }
      }
    }
    if (tooltipTextAfterClick) {
      setCurrentText(tooltipTextAfterClick);
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  const tooltipContent = tooltipComponent ? (
    tooltipComponent
  ) : (
    <Tooltip data-testid={dataTestId}>{currentText}</Tooltip>
  );

  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
      <div ref={triggerRef}>{children}</div>
      <div ref={tooltipRef}>{isVisible && tooltipContent}</div>
    </div>
  );
};
