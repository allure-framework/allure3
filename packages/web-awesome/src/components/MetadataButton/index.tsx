import { ArrowButton, Counter, Text, TooltipWrapper } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren, FunctionalComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import * as styles from "./styles.scss";

interface MetadataButtonProps {
  isOpened?: boolean;
  setIsOpen: (isOpen: boolean) => void;
  counter?: number;
  title?: ComponentChildren;
  titleTooltipText?: string;
  truncateTitle?: boolean;
}

export const MetadataButton: FunctionalComponent<MetadataButtonProps> = ({
  isOpened,
  setIsOpen,
  counter,
  title,
  titleTooltipText,
  truncateTitle = false,
  ...rest
}) => {
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);

  useEffect(() => {
    if (!truncateTitle) {
      setIsTitleTruncated(false);
      return;
    }

    const element = titleRef.current;

    if (!element) {
      return;
    }

    const syncOverflow = () => {
      setIsTitleTruncated(element.scrollWidth > element.clientWidth);
    };

    syncOverflow();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(syncOverflow);
    observer.observe(element);

    return () => observer.disconnect();
  }, [title, truncateTitle]);

  const titleNode = (
    <Text size={"m"} bold className={clsx(truncateTitle && styles["report-metadata-title-container"])}>
      <span ref={titleRef} className={clsx(truncateTitle && styles["report-metadata-title-truncated"])}>
        {title}
      </span>
    </Text>
  );

  const buttonNode = (
    <button
      {...rest}
      className={clsx(
        styles["report-metadata-header"],
        truncateTitle && styles["report-metadata-header-truncated"],
        isOpened && styles["report-metadata-header-opened"],
      )}
      type={"button"}
      onClick={() => setIsOpen(!isOpened)}
    >
      {titleNode}
      {!!counter && <Counter count={counter} size="s" />}
      <ArrowButton
        isOpened={isOpened}
        iconSize={"s"}
        buttonSize={"s"}
        className={styles["report-metadata-header-arrow"]}
        tag={"div"}
      />
    </button>
  );

  const shouldRenderTooltip = !!titleTooltipText && (!truncateTitle || isTitleTruncated);

  if (shouldRenderTooltip) {
    return <TooltipWrapper tooltipText={titleTooltipText}>{buttonNode}</TooltipWrapper>;
  }

  return buttonNode;
};
