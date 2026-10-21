import clsx from "clsx";

import styles from "./styles.scss";

export const DEFAULT_START_LENGTH = 8;
export const DEFAULT_END_LENGTH = 6;

export type MiddleEllipsisProps = {
  /**
   * The text which is shortened in the middle: a hash, a long identifier. The full text is in the title
   */
  text: string;
  /**
   * How many first characters are shown
   */
  startLength?: number;
  /**
   * How many last characters are shown
   */
  endLength?: number;
  /**
   * The mark of the cut part
   */
  ellipsis?: string;
  className?: string;
};

/**
 * The text which keeps its start and its end and has the ellipsis instead of the middle, as the hashes usually do: `7978df3c…c95061`.
 * The text which is not longer than the start, the end and the ellipsis together is shown as it is
 */
export const MiddleEllipsis = ({
  text,
  startLength = DEFAULT_START_LENGTH,
  endLength = DEFAULT_END_LENGTH,
  ellipsis = "…",
  className,
}: MiddleEllipsisProps) => {
  const isCut = text.length > startLength + endLength + ellipsis.length;
  const shown = isCut ? `${text.slice(0, startLength)}${ellipsis}${text.slice(text.length - endLength)}` : text;

  return (
    <span className={clsx(styles.root, className)} title={isCut ? text : undefined} data-testid="middle-ellipsis">
      {shown}
    </span>
  );
};
