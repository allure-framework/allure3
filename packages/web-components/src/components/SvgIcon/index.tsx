import { clsx } from "clsx";
import type { JSX } from "preact";
import arrowsChevronDown from "@/assets/svg/arrows-chevron-down.svg";
import github from "@/assets/svg/github.svg";
import lineAlertsAlertCircle from "@/assets/svg/line-alerts-alert-circle.svg";
import lineAlertsNotificationBox from "@/assets/svg/line-alerts-notification-box.svg";
import lineArrowsChevronDownDouble from "@/assets/svg/line-arrows-chevron-down-double.svg";
import lineArrowsChevronDown from "@/assets/svg/line-arrows-chevron-down.svg";
import lineArrowsChevronRight from "@/assets/svg/line-arrows-chevron-right.svg";
import lineArrowsChevronUpDouble from "@/assets/svg/line-arrows-chevron-up-double.svg";
import lineArrowsChevronUp from "@/assets/svg/line-arrows-chevron-up.svg";
import lineArrowsCornerDownRight from "@/assets/svg/line-arrows-corner-down-right.svg";
import lineArrowsExpand3 from "@/assets/svg/line-arrows-expand-3.svg";
import lineArrowsRefreshCcw1 from "@/assets/svg/line-arrows-refresh-ccw-1.svg";
import lineArrowsSortLineAsc from "@/assets/svg/line-arrows-sort-line-asc.svg";
import lineArrowsSortLineDesc from "@/assets/svg/line-arrows-sort-line-desc.svg";
import lineArrowsSwitchVertical1 from "@/assets/svg/line-arrows-switch-vertical-1.svg";
import lineChartsBarChartSquare from "@/assets/svg/line-charts-bar-chart-square.svg";
import lineDevBug2 from "@/assets/svg/line-dev-bug-2.svg";
import lineDevCodeSquare from "@/assets/svg/line-dev-code-square.svg";
import lineDevDataflow3 from "@/assets/svg/line-dev-dataflow-3.svg";
import lineFilesClipboardCheck from "@/assets/svg/line-files-clipboard-check.svg";
import lineFilesFile2 from "@/assets/svg/line-files-file-2.svg";
import lineFilesFileAttachment2 from "@/assets/svg/line-files-file-attachment-2.svg";
import lineFilesFolder from "@/assets/svg/line-files-folder.svg";
import lineGeneralCheck from "@/assets/svg/line-general-check.svg";
import lineGeneralChecklist3 from "@/assets/svg/line-general-checklist3.svg";
import lineGeneralCopy3 from "@/assets/svg/line-general-copy-3.svg";
import lineGeneralDownloadCloud from "@/assets/svg/line-general-download-cloud.svg";
import lineGeneralEqual from "@/assets/svg/line-general-equal.svg";
import lineGeneralEye from "@/assets/svg/line-general-eye.svg";
import lineGeneralHomeLine from "@/assets/svg/line-general-home-line.svg";
import lineGeneralLink1 from "@/assets/svg/line-general-link-1.svg";
import lineGeneralLinkExternal from "@/assets/svg/line-general-link-external.svg";
import lineGeneralSearchMd from "@/assets/svg/line-general-search-md.svg";
import lineGeneralSettings1 from "@/assets/svg/line-general-settings-1.svg";
import lineGeneralXClose from "@/assets/svg/line-general-x-close.svg";
import lineGeneralZap from "@/assets/svg/line-general-zap.svg";
import lineHelpersFlag from "@/assets/svg/line-helpers-flag.svg";
import lineHelpersPlayCircle from "@/assets/svg/line-helpers-play-circle.svg";
import lineIconBomb2 from "@/assets/svg/line-icon-bomb-2.svg";
import lineImagesImage from "@/assets/svg/line-images-image.svg";
import lineSecurityKey from "@/assets/svg/line-security-key.svg";
import lineShapesDotCircle from "@/assets/svg/line-shapes-dot-circle.svg";
import lineShapesMoon from "@/assets/svg/line-shapes-moon.svg";
import lineShapesSun from "@/assets/svg/line-shapes-sun.svg";
import lineTimeClockStopwatch from "@/assets/svg/line-time-clock-stopwatch.svg";
import reportLogo from "@/assets/svg/report-logo.svg";
import solidAlertCircle from "@/assets/svg/solid-alert-circle.svg";
import solidCheckCircle from "@/assets/svg/solid-check-circle.svg";
import solidHelpCircle from "@/assets/svg/solid-help-circle.svg";
import solidMinusCircle from "@/assets/svg/solid-minus-circle.svg";
import solidXCircle from "@/assets/svg/solid-x-circle.svg";
import spinner from "@/assets/svg/spinner.svg";
import viewOff from "@/assets/svg/view-off.svg";
import view from "@/assets/svg/view.svg";
import styles from "./styles.scss";

export const allureIcons = {
  arrowsChevronDown: arrowsChevronDown.id,
  github: github.id,
  lineAlertsAlertCircle: lineAlertsAlertCircle.id,
  lineAlertsNotificationBox: lineAlertsNotificationBox.id,
  lineArrowsChevronDown: lineArrowsChevronDown.id,
  lineArrowsChevronDownDouble: lineArrowsChevronDownDouble.id,
  lineArrowsChevronRight: lineArrowsChevronRight.id,
  lineArrowsChevronUp: lineArrowsChevronUp.id,
  lineArrowsChevronUpDouble: lineArrowsChevronUpDouble.id,
  lineArrowsCornerDownRight: lineArrowsCornerDownRight.id,
  lineArrowsExpand3: lineArrowsExpand3.id,
  lineArrowsRefreshCcw1: lineArrowsRefreshCcw1.id,
  lineArrowsSortLineAsc: lineArrowsSortLineAsc.id,
  lineArrowsSortLineDesc: lineArrowsSortLineDesc.id,
  lineArrowsSwitchVertical1: lineArrowsSwitchVertical1.id,
  lineChartsBarChartSquare: lineChartsBarChartSquare.id,
  lineDevBug2: lineDevBug2.id,
  lineDevCodeSquare: lineDevCodeSquare.id,
  lineDevDataflow3: lineDevDataflow3.id,
  lineFilesClipboardCheck: lineFilesClipboardCheck.id,
  lineFilesFile2: lineFilesFile2.id,
  lineFilesFileAttachment2: lineFilesFileAttachment2.id,
  lineFilesFolder: lineFilesFolder.id,
  lineGeneralCheck: lineGeneralCheck.id,
  lineGeneralChecklist3: lineGeneralChecklist3.id,
  lineGeneralCopy3: lineGeneralCopy3.id,
  lineGeneralDownloadCloud: lineGeneralDownloadCloud.id,
  lineGeneralEqual: lineGeneralEqual.id,
  lineGeneralEye: lineGeneralEye.id,
  lineGeneralHomeLine: lineGeneralHomeLine.id,
  lineGeneralLink1: lineGeneralLink1.id,
  lineGeneralLinkExternal: lineGeneralLinkExternal.id,
  lineGeneralSearchMd: lineGeneralSearchMd.id,
  lineGeneralSettings1: lineGeneralSettings1.id,
  lineGeneralXClose: lineGeneralXClose.id,
  lineGeneralZap: lineGeneralZap.id,
  lineHelpersFlag: lineHelpersFlag.id,
  lineHelpersPlayCircle: lineHelpersPlayCircle.id,
  lineIconBomb2: lineIconBomb2.id,
  lineImagesImage: lineImagesImage.id,
  lineSecurityKey: lineSecurityKey.id,
  lineShapesDotCircle: lineShapesDotCircle.id,
  lineShapesMoon: lineShapesMoon.id,
  lineShapesSun: lineShapesSun.id,
  lineTimeClockStopwatch: lineTimeClockStopwatch.id,
  reportLogo: reportLogo.id,
  solidAlertCircle: solidAlertCircle.id,
  solidCheckCircle: solidCheckCircle.id,
  solidHelpCircle: solidHelpCircle.id,
  solidMinusCircle: solidMinusCircle.id,
  solidXCircle: solidXCircle.id,
  spinner: spinner.id,
  view: view.id,
  viewOff: viewOff.id,
};

export type SvgIconProps = Omit<JSX.HTMLAttributes<SVGElement>, "className" | "id" | "size" | "inline"> & {
  /**
   * "xs" is 12x12
   * "s" is 16x16
   * "m" size is 20x20
   *
   * @default s
   */
  size?: "xs" | "s" | "m";
  /**
   * Additional class name
   */
  className?: string;
  /**
   * Icon id
   *
   * @example
   * import lineShapesMoonIcon from "@/components/assets/svg/line-shapes-moon.svg";
   *
   * <SvgIcon id={lineShapesMoonIcon.id} />
   */
  id: string;
  /**
   * Inline icon
   */
  inline?: boolean;
};

/**
 * Renders SVG icon
 *
 * default size is 16x16
 */
export const SvgIcon = ({ id, size = "s", inline = false, className = "" }: SvgIconProps) => {
  return (
    <svg className={clsx(styles.icon, styles[`size-${size}`], inline && styles.inline, className)}>
      <use xlinkHref={`#${id}`} />
    </svg>
  );
};
