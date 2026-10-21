import { ButtonLink } from "@/components/Button";
import { allureIcons } from "@/components/SvgIcon";
import { TooltipWrapper } from "@/components/Tooltip";
import { useElementTruncation } from "@/hooks/useElementTruncation";

import styles from "./styles.scss";

export type OverviewLinkProps = {
  /**
   * Link to the overview page of the multi-plugin report
   */
  href: string;
  /**
   * Already translated label of the link
   */
  text: string;
};

/**
 * "Back to overview" link of the report that is a part of the multi-plugin report.
 * The label is truncated when there is not enough space, the full label is shown in the tooltip then
 */
export const OverviewLink = ({ href, text }: OverviewLinkProps) => {
  const { ref, isTruncated } = useElementTruncation<HTMLSpanElement>([text]);

  return (
    <TooltipWrapper
      tooltipText={text}
      placement="bottom"
      isTriggerActive={isTruncated}
      className={styles.wrapper}
      triggerClassName={styles.trigger}
    >
      <ButtonLink
        href={href}
        text={text}
        textRef={ref}
        isTextTruncated
        style="ghost"
        action="accent"
        size="m"
        icon={allureIcons.lineArrowsArrowLeft}
        className={styles.link}
        data-testid="overview-link"
      />
    </TooltipWrapper>
  );
};
