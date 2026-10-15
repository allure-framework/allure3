import { IconButton, TooltipWrapper, allureIcons } from "@allurereport/web-components";

import { useI18n } from "@/stores/locale";
import { allTreesCollapsed, allTreesExpanded, hasCollapsibleTrees, setAllTreesOpened } from "@/stores/tree";

export const CollapseAll = () => {
  const { t } = useI18n("controls");

  if (!hasCollapsibleTrees.value) {
    return null;
  }

  const isCollapsed = allTreesCollapsed.value;
  // the button has three states: every group is collapsed, every group is expanded or only a part of them is expanded,
  // in the last two it collapses the groups, so the tooltip tells which state it is in
  let label = t("collapseAllPartial");

  if (isCollapsed) {
    label = t("expandAll");
  } else if (allTreesExpanded.value) {
    label = t("collapseAll");
  }

  const icon = isCollapsed ? allureIcons.lineArrowsChevronDownDouble : allureIcons.lineArrowsChevronUpDouble;

  return (
    <TooltipWrapper tooltipText={label}>
      <IconButton
        data-testid="collapse-all-button"
        aria-label={label}
        size="s"
        style="ghost"
        icon={icon}
        onClick={() => setAllTreesOpened(isCollapsed)}
      />
    </TooltipWrapper>
  );
};
