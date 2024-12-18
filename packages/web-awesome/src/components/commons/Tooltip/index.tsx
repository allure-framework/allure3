import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import { FunctionalComponent, VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Text } from "@/components/commons/Typography";
import * as styles from "./styles.scss";

interface TooltipWrapperProps {
  tooltipText?: string;
  tooltipTextAfterClick?: string;
  tooltipComponent?: FunctionalComponent | VNode;
  children: VNode;
  placement?: "top" | "bottom" | "left" | "right";
  triggerMode?: "hover" | "click";
  autoHideDelay?: number;
  isTriggerActive?: boolean;
}

const Tooltip = ({ children }) => (
  <div className={styles[`custom-tooltip`]}>
    <Text className="tooltip-content" size={"s"} bold>
      {children}
    </Text>
  </div>
);

export const TooltipWrapper: FunctionalComponent<TooltipWrapperProps> = ({
  tooltipText,
  tooltipTextAfterClick,
  tooltipComponent,
  children,
  placement = "top",
  triggerMode = "hover",
  autoHideDelay = 600,
  isTriggerActive = true,
}) => {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentText, setCurrentText] = useState(tooltipText);
  const hideTimer = useRef<number | null>(null);

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
    if (triggerMode === "hover" && isTriggerActive) setIsVisible(true);

    if (triggerMode === "click" && hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
  };

  const onMouseLeave = () => {
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

  const tooltipContent = tooltipComponent ? tooltipComponent : <Tooltip>{currentText}</Tooltip>;

  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
      <div ref={triggerRef}>{children}</div>
      <div ref={tooltipRef}>{isVisible && tooltipContent}</div>
    </div>
  );
};
