import { clsx } from "clsx";
import type { JSX } from "preact";
import amazon from "@/assets/svg/amazon.svg";
import arrowsChevronDown from "@/assets/svg/arrows-chevron-down.svg";
import azure from "@/assets/svg/azure.svg";
import bitbucket from "@/assets/svg/bitbucket.svg";
import circleci from "@/assets/svg/circleci.svg";
import draggable from "@/assets/svg/draggable.svg";
import drone from "@/assets/svg/drone.svg";
import environment from "@/assets/svg/environment.svg";
import github from "@/assets/svg/github.svg";
import gitlab from "@/assets/svg/gitlab.svg";
import jenkins from "@/assets/svg/jenkins.svg";
import lineAlertsAlertCircle from "@/assets/svg/line-alerts-alert-circle.svg";
import lineAlertsFixed from "@/assets/svg/line-alerts-fixed.svg";
import lineAlertsMalfunctioned from "@/assets/svg/line-alerts-malfunctioned.svg";
import lineAlertsNew from "@/assets/svg/line-alerts-new.svg";
import lineAlertsNotificationBox from "@/assets/svg/line-alerts-notification-box.svg";
import lineAlertsRegressed from "@/assets/svg/line-alerts-regressed.svg";
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
import lineChartsTimeline from "@/assets/svg/line-charts-timeline.svg";
import lineDevBug2 from "@/assets/svg/line-dev-bug-2.svg";
import lineDevCodeSquare from "@/assets/svg/line-dev-code-square.svg";
import lineDevDataflow3 from "@/assets/svg/line-dev-dataflow-3.svg";
import lineFilesClipboardCheck from "@/assets/svg/line-files-clipboard-check.svg";
import lineFilesFile2 from "@/assets/svg/line-files-file-2.svg";
import lineFilesFileAttachment2 from "@/assets/svg/line-files-file-attachment-2.svg";
import lineFilesFolder from "@/assets/svg/line-files-folder.svg";
import lineGeneralCheckCircle from "@/assets/svg/line-general-check-circle.svg";
import lineGeneralCheck from "@/assets/svg/line-general-check.svg";
import lineGeneralChecklist3 from "@/assets/svg/line-general-checklist3.svg";
import lineGeneralCopy3 from "@/assets/svg/line-general-copy-3.svg";
import lineGeneralDownloadCloud from "@/assets/svg/line-general-download-cloud.svg";
import lineGeneralEqual from "@/assets/svg/line-general-equal.svg";
import lineGeneralEye from "@/assets/svg/line-general-eye.svg";
import lineGeneralHelpCircle from "@/assets/svg/line-general-help-circle.svg";
import lineGeneralHomeLine from "@/assets/svg/line-general-home-line.svg";
import lineGeneralInfoCircle from "@/assets/svg/line-general-info-circle.svg";
import lineGeneralLink1 from "@/assets/svg/line-general-link-1.svg";
import lineGeneralLinkExternal from "@/assets/svg/line-general-link-external.svg";
import lineGeneralMinusCircle from "@/assets/svg/line-general-minus-circle.svg";
import lineGeneralSearchMd from "@/assets/svg/line-general-search-md.svg";
import lineGeneralSettings1 from "@/assets/svg/line-general-settings-1.svg";
import lineGeneralXCircle from "@/assets/svg/line-general-x-circle.svg";
import lineGeneralXClose from "@/assets/svg/line-general-x-close.svg";
import lineGeneralZap from "@/assets/svg/line-general-zap.svg";
import lineHelpersFlag from "@/assets/svg/line-helpers-flag.svg";
import lineHelpersPlayCircle from "@/assets/svg/line-helpers-play-circle.svg";
import lineIconBomb2 from "@/assets/svg/line-icon-bomb-2.svg";
import lineImagesImage from "@/assets/svg/line-images-image.svg";
import lineLayoutsColumn2 from "@/assets/svg/line-layouts-columns-2.svg";
import lineLayoutsLayoutTop from "@/assets/svg/line-layouts-layout-top.svg";
import lineLayoutsMaximize2 from "@/assets/svg/line-layouts-maximize-2.svg";
import lineLayoutsMinimize2 from "@/assets/svg/line-layouts-minimize-2.svg";
import lineSecurityKey from "@/assets/svg/line-security-key.svg";
import lineShapesDotCircle from "@/assets/svg/line-shapes-dot-circle.svg";
import lineShapesMoon from "@/assets/svg/line-shapes-moon.svg";
import lineShapesSun from "@/assets/svg/line-shapes-sun.svg";
import lineShapesThemeAuto from "@/assets/svg/line-shapes-theme-auto.svg";
import lineTimeClockStopwatch from "@/assets/svg/line-time-clock-stopwatch.svg";
import playwrightLogo from "@/assets/svg/playwright-logo.svg";
import reportLogo from "@/assets/svg/report-logo.svg";
import solidAlertCircle from "@/assets/svg/solid-alert-circle.svg";
import solidCheckCircle from "@/assets/svg/solid-check-circle.svg";
import solidHelpCircle from "@/assets/svg/solid-help-circle.svg";
import solidMinusCircle from "@/assets/svg/solid-minus-circle.svg";
import solidPlusCircle from "@/assets/svg/solid-plus-circle.svg";
import solidXCircle from "@/assets/svg/solid-x-circle.svg";
import spinner from "@/assets/svg/spinner.svg";
import testNew from "@/assets/svg/test-new.svg";
import viewOff from "@/assets/svg/view-off.svg";
import view from "@/assets/svg/view.svg";
import styles from "./styles.scss";

export const allureIcons = {
  amazon: amazon.id,
  arrowsChevronDown: arrowsChevronDown.id,
  azure: azure.id,
  bitbucket: bitbucket.id,
  circleci: circleci.id,
  draggable: draggable.id,
  drone: drone.id,
  environment: environment.id,
  github: github.id,
  gitlab: gitlab.id,
  jenkins: jenkins.id,
  lineAlertsAlertCircle: lineAlertsAlertCircle.id,
  lineAlertsFixed: lineAlertsFixed.id,
  lineAlertsMalfunctioned: lineAlertsMalfunctioned.id,
  lineAlertsNew: lineAlertsNew.id,
  lineAlertsNotificationBox: lineAlertsNotificationBox.id,
  lineAlertsRegressed: lineAlertsRegressed.id,
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
  lineChartsTimeline: lineChartsTimeline.id,
  lineDevBug2: lineDevBug2.id,
  lineDevCodeSquare: lineDevCodeSquare.id,
  lineDevDataflow3: lineDevDataflow3.id,
  lineFilesClipboardCheck: lineFilesClipboardCheck.id,
  lineFilesFile2: lineFilesFile2.id,
  lineFilesFileAttachment2: lineFilesFileAttachment2.id,
  lineFilesFolder: lineFilesFolder.id,
  lineGeneralCheck: lineGeneralCheck.id,
  lineGeneralCheckCircle: lineGeneralCheckCircle.id,
  lineGeneralChecklist3: lineGeneralChecklist3.id,
  lineGeneralCopy3: lineGeneralCopy3.id,
  lineGeneralDownloadCloud: lineGeneralDownloadCloud.id,
  lineGeneralEqual: lineGeneralEqual.id,
  lineGeneralEye: lineGeneralEye.id,
  lineGeneralHelpCircle: lineGeneralHelpCircle.id,
  lineGeneralHomeLine: lineGeneralHomeLine.id,
  lineGeneralInfoCircle: lineGeneralInfoCircle.id,
  lineGeneralLink1: lineGeneralLink1.id,
  lineGeneralLinkExternal: lineGeneralLinkExternal.id,
  lineGeneralMinusCircle: lineGeneralMinusCircle.id,
  lineGeneralSearchMd: lineGeneralSearchMd.id,
  lineGeneralSettings1: lineGeneralSettings1.id,
  lineGeneralXCircle: lineGeneralXCircle.id,
  lineGeneralXClose: lineGeneralXClose.id,
  lineGeneralZap: lineGeneralZap.id,
  lineHelpersFlag: lineHelpersFlag.id,
  lineHelpersPlayCircle: lineHelpersPlayCircle.id,
  lineIconBomb2: lineIconBomb2.id,
  lineImagesImage: lineImagesImage.id,
  lineLayoutsColumn2: lineLayoutsColumn2.id,
  lineLayoutsLayoutTop: lineLayoutsLayoutTop.id,
  lineLayoutsMaximize2: lineLayoutsMaximize2.id,
  lineLayoutsMinimize2: lineLayoutsMinimize2.id,
  lineSecurityKey: lineSecurityKey.id,
  lineShapesDotCircle: lineShapesDotCircle.id,
  lineShapesMoon: lineShapesMoon.id,
  lineShapesSun: lineShapesSun.id,
  lineShapesThemeAuto: lineShapesThemeAuto.id,
  lineTimeClockStopwatch: lineTimeClockStopwatch.id,
  playwrightLogo: playwrightLogo.id,
  reportLogo: reportLogo.id,
  solidAlertCircle: solidAlertCircle.id,
  solidCheckCircle: solidCheckCircle.id,
  solidHelpCircle: solidHelpCircle.id,
  solidMinusCircle: solidMinusCircle.id,
  solidPlusCircle: solidPlusCircle.id,
  solidXCircle: solidXCircle.id,
  spinner: spinner.id,
  testNew: testNew.id,
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
  "size"?: "xs" | "s" | "m";
  /**
   * Additional class name
   */
  "className"?: string;
  /**
   * Icon id
   *
   * @example
   * import lineShapesMoonIcon from "@/components/assets/svg/line-shapes-moon.svg";
   *
   * <SvgIcon id={lineShapesMoonIcon.id} />
   */
  "id": string;
  /**
   * Inline icon
   */
  "inline"?: boolean;
  /**
   * Data test id
   */
  "data-testid"?: string;
};

/**
 * Renders SVG icon
 *
 * default size is 16x16
 */
export const SvgIcon = ({
  id,
  size = "s",
  inline = false,
  className = "",
  "data-testid": dataTestId,
}: SvgIconProps) => {
  return (
    <svg
      className={clsx(styles.icon, styles[`size-${size}`], inline && styles.inline, className)}
      data-testid={dataTestId}
    >
      <use xlinkHref={`#${id}`} />
    </svg>
  );
};
