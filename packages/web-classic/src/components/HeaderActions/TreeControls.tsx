import { reportDataUrl } from "@allurereport/web-commons";
import { IconButton, TooltipWrapper, allureIcons } from "@allurereport/web-components";

import { useTreeStore } from "@/components/Tree/context";
import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

/**
 * Downloads the CSV file the plugin writes for the tree.
 * In single-file reports the file is embedded into the report and downloaded from a data URL.
 * Returns `false` when the file is unavailable (e.g. a report generated without CSV files).
 */
export const downloadTreeCsv = async (csvFileName: string): Promise<boolean> => {
  let url: string;

  try {
    url = await reportDataUrl(`data/${csvFileName}`, "text/csv", { bustCache: true });
  } catch (e) {
    console.error(`Failed to download ${csvFileName}`, e);

    return false;
  }

  const link = globalThis.document.createElement("a");

  link.href = url;
  link.download = csvFileName;
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();

  return true;
};

/**
 * Allure 2 tree pane controls: collapse/expand all groups, toggle groups info and download CSV
 */
export const TreeControls = () => {
  const { t } = useI18n("tree");
  const { collapseAll, expandAll, showGroupsInfo, toggleGroupsInfo, csvFileName } = useTreeStore();
  const groupsInfoLabel = showGroupsInfo.value ? t("hide-groups-info") : t("show-groups-info");

  return (
    <div className={styles["tree-controls"]}>
      <TooltipWrapper tooltipText={t("collapse-all")}>
        <IconButton
          icon={allureIcons.lineArrowsChevronUpDouble}
          style="ghost"
          size="s"
          aria-label={t("collapse-all")}
          data-testid="tree-collapse-all"
          onClick={collapseAll}
        />
      </TooltipWrapper>
      <TooltipWrapper tooltipText={t("expand-all")}>
        <IconButton
          icon={allureIcons.lineArrowsChevronDownDouble}
          style="ghost"
          size="s"
          aria-label={t("expand-all")}
          data-testid="tree-expand-all"
          onClick={expandAll}
        />
      </TooltipWrapper>
      <TooltipWrapper tooltipText={groupsInfoLabel}>
        <IconButton
          icon={allureIcons.lineGeneralInfoCircle}
          style="ghost"
          size="s"
          isActive={showGroupsInfo.value}
          aria-label={groupsInfoLabel}
          aria-pressed={showGroupsInfo.value}
          data-testid="tree-toggle-groups-info"
          onClick={toggleGroupsInfo}
        />
      </TooltipWrapper>
      <TooltipWrapper tooltipText={t("download-csv")}>
        <IconButton
          icon={allureIcons.lineGeneralDownloadCloud}
          style="ghost"
          size="s"
          aria-label={t("download-csv")}
          data-testid="tree-download-csv"
          onClick={() => downloadTreeCsv(csvFileName)}
        />
      </TooltipWrapper>
    </div>
  );
};
