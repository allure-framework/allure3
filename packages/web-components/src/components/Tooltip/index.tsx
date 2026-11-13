import type { Placement } from "@floating-ui/dom";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { FunctionalComponent, VNode } from "preact";
import type { MutableRefObject } from "preact/compat";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

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
  /**
   * Class of the outer element of the wrapper, e.g. to let it shrink in a flex container
   */
  "className"?: string;
  /**
   * Class of the element that wraps the children and listens to the trigger events
   */
  "triggerClassName"?: string;
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
  triggerRef: MutableRefObject<TriggerRef | null>;
  tooltipRef: MutableRefObject<TooltipRef | null>;
}) => {
  const { placement = "top", triggerRef, tooltipRef, isVisible } = props;

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!isVisible || !trigger || !tooltip) {
      return;
    }

    let active = true;
    const updatePosition = () => {
      computePosition(trigger, tooltip, {
        placement,
        middleware: [offset(6), flip(), shift({ padding: 5 })],
      }).then(({ x, y }) => {
        if (active)
          Object.assign(tooltip.style, {
            "left": `${x}px`,
            "top": `${y}px`,
            "position": "absolute",
            "z-index": 100,
          });
      });
    };

    updatePosition();

    const release = autoUpdate(trigger, tooltip, updatePosition);
    return () => {
      active = false;
      release();
    };
  }, [isVisible, placement, triggerRef, tooltipRef]);
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
  className,
  triggerClassName,
}) => {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentText, setCurrentText] = useState(tooltipText);
  const hideTimer = useRef<number | null>(null);
  const showTimer = useRef<number | null>(null);
  const showTooltip = isVisible && isTriggerActive;

  useEffect(() => {
    setCurrentText(tooltipText);
  }, [tooltipText]);

  useLayoutEffect(() => {
    if (!showTooltip || !triggerRef.current || !tooltipRef.current) {
      return;
    }

    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    let active = true;
    const updatePosition = () => {
      computePosition(trigger, tooltip, {
        placement,
        middleware: [offset(6), flip(), shift({ padding: 5 })],
      }).then(({ x, y }) => {
        if (!active) {
          return;
        }
        Object.assign(tooltip.style, {
          inset: `${y}px auto auto ${x}px`,
          visibility: "visible",
        });
      });
    };

    const release = autoUpdate(trigger, tooltip, updatePosition);
    return () => {
      active = false;
      release();
    };
  }, [showTooltip, placement, tooltipText]);

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
      if (showTimer.current) {
        clearTimeout(showTimer.current);
      }
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
    <div className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
      <div ref={triggerRef} className={triggerClassName}>
        {children}
      </div>
      {showTooltip && (
        <div ref={tooltipRef} className={styles["tooltip-positioner"]}>
          {tooltipContent}
        </div>
      )}
    </div>
  );
};
