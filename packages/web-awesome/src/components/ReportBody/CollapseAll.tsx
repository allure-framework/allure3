import { IconButton, TooltipWrapper, allureIcons } from "@allurereport/web-components";

import { useI18n } from "@/stores/locale";
import { allTreesCollapsed, hasCollapsibleTrees, setAllTreesOpened } from "@/stores/tree";

export const CollapseAll = () => {
  const { t } = useI18n("controls");

  if (!hasCollapsibleTrees.value) {
    return null;
  }

  const isCollapsed = allTreesCollapsed.value;
  const label = isCollapsed ? t("expandAll") : t("collapseAll");
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
