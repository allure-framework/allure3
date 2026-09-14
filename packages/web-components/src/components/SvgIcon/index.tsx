import { clsx } from "clsx";
import type { ComponentType, JSX, SVGAttributes } from "preact";

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

type SvgIconComponent = ComponentType<SVGAttributes<SVGSVGElement>>;
type SvgIconSource = SvgIconComponent | string;

const iconComponents = {
  "amazon": amazon,
  "arrows-chevron-down": arrowsChevronDown,
  "azure": azure,
  "bitbucket": bitbucket,
  "circleci": circleci,
  "draggable": draggable,
  "drone": drone,
  "environment": environment,
  "github": github,
  "gitlab": gitlab,
  "jenkins": jenkins,
  "line-alerts-alert-circle": lineAlertsAlertCircle,
  "line-alerts-fixed": lineAlertsFixed,
  "line-alerts-malfunctioned": lineAlertsMalfunctioned,
  "line-alerts-new": lineAlertsNew,
  "line-alerts-notification-box": lineAlertsNotificationBox,
  "line-alerts-regressed": lineAlertsRegressed,
  "line-arrows-chevron-down-double": lineArrowsChevronDownDouble,
  "line-arrows-chevron-down": lineArrowsChevronDown,
  "line-arrows-chevron-right": lineArrowsChevronRight,
  "line-arrows-chevron-up-double": lineArrowsChevronUpDouble,
  "line-arrows-chevron-up": lineArrowsChevronUp,
  "line-arrows-corner-down-right": lineArrowsCornerDownRight,
  "line-arrows-expand-3": lineArrowsExpand3,
  "line-arrows-refresh-ccw-1": lineArrowsRefreshCcw1,
  "line-arrows-sort-line-asc": lineArrowsSortLineAsc,
  "line-arrows-sort-line-desc": lineArrowsSortLineDesc,
  "line-arrows-switch-vertical-1": lineArrowsSwitchVertical1,
  "line-charts-bar-chart-square": lineChartsBarChartSquare,
  "line-charts-timeline": lineChartsTimeline,
  "line-dev-bug-2": lineDevBug2,
  "line-dev-code-square": lineDevCodeSquare,
  "line-dev-dataflow-3": lineDevDataflow3,
  "line-files-clipboard-check": lineFilesClipboardCheck,
  "line-files-file-2": lineFilesFile2,
  "line-files-file-attachment-2": lineFilesFileAttachment2,
  "line-files-folder": lineFilesFolder,
  "line-general-check-circle": lineGeneralCheckCircle,
  "line-general-check": lineGeneralCheck,
  "line-general-checklist3": lineGeneralChecklist3,
  "line-general-copy-3": lineGeneralCopy3,
  "line-general-download-cloud": lineGeneralDownloadCloud,
  "line-general-equal": lineGeneralEqual,
  "line-general-eye": lineGeneralEye,
  "line-general-help-circle": lineGeneralHelpCircle,
  "line-general-home-line": lineGeneralHomeLine,
  "line-general-info-circle": lineGeneralInfoCircle,
  "line-general-link-1": lineGeneralLink1,
  "line-general-link-external": lineGeneralLinkExternal,
  "line-general-minus-circle": lineGeneralMinusCircle,
  "line-general-search-md": lineGeneralSearchMd,
  "line-general-settings-1": lineGeneralSettings1,
  "line-general-x-circle": lineGeneralXCircle,
  "line-general-x-close": lineGeneralXClose,
  "line-general-zap": lineGeneralZap,
  "line-helpers-flag": lineHelpersFlag,
  "line-helpers-play-circle": lineHelpersPlayCircle,
  "line-icon-bomb-2": lineIconBomb2,
  "line-images-image": lineImagesImage,
  "line-layouts-columns-2": lineLayoutsColumn2,
  "line-layouts-layout-top": lineLayoutsLayoutTop,
  "line-layouts-maximize-2": lineLayoutsMaximize2,
  "line-layouts-minimize-2": lineLayoutsMinimize2,
  "line-security-key": lineSecurityKey,
  "line-shapes-dot-circle": lineShapesDotCircle,
  "line-shapes-moon": lineShapesMoon,
  "line-shapes-sun": lineShapesSun,
  "line-shapes-theme-auto": lineShapesThemeAuto,
  "line-time-clock-stopwatch": lineTimeClockStopwatch,
  "playwright-logo": playwrightLogo,
  "report-logo": reportLogo,
  "solid-alert-circle": solidAlertCircle,
  "solid-check-circle": solidCheckCircle,
  "solid-help-circle": solidHelpCircle,
  "solid-minus-circle": solidMinusCircle,
  "solid-plus-circle": solidPlusCircle,
  "solid-x-circle": solidXCircle,
  "spinner": spinner,
  "test-new": testNew,
  "view-off": viewOff,
  "view": view,
} satisfies Record<string, SvgIconSource>;

export const allureIcons = {
  amazon: "amazon",
  arrowsChevronDown: "arrows-chevron-down",
  azure: "azure",
  bitbucket: "bitbucket",
  circleci: "circleci",
  draggable: "draggable",
  drone: "drone",
  environment: "environment",
  github: "github",
  gitlab: "gitlab",
  jenkins: "jenkins",
  lineAlertsAlertCircle: "line-alerts-alert-circle",
  lineAlertsFixed: "line-alerts-fixed",
  lineAlertsMalfunctioned: "line-alerts-malfunctioned",
  lineAlertsNew: "line-alerts-new",
  lineAlertsNotificationBox: "line-alerts-notification-box",
  lineAlertsRegressed: "line-alerts-regressed",
  lineArrowsChevronDownDouble: "line-arrows-chevron-down-double",
  lineArrowsChevronDown: "line-arrows-chevron-down",
  lineArrowsChevronRight: "line-arrows-chevron-right",
  lineArrowsChevronUpDouble: "line-arrows-chevron-up-double",
  lineArrowsChevronUp: "line-arrows-chevron-up",
  lineArrowsCornerDownRight: "line-arrows-corner-down-right",
  lineArrowsExpand3: "line-arrows-expand-3",
  lineArrowsRefreshCcw1: "line-arrows-refresh-ccw-1",
  lineArrowsSortLineAsc: "line-arrows-sort-line-asc",
  lineArrowsSortLineDesc: "line-arrows-sort-line-desc",
  lineArrowsSwitchVertical1: "line-arrows-switch-vertical-1",
  lineChartsBarChartSquare: "line-charts-bar-chart-square",
  lineChartsTimeline: "line-charts-timeline",
  lineDevBug2: "line-dev-bug-2",
  lineDevCodeSquare: "line-dev-code-square",
  lineDevDataflow3: "line-dev-dataflow-3",
  lineFilesClipboardCheck: "line-files-clipboard-check",
  lineFilesFile2: "line-files-file-2",
  lineFilesFileAttachment2: "line-files-file-attachment-2",
  lineFilesFolder: "line-files-folder",
  lineGeneralCheckCircle: "line-general-check-circle",
  lineGeneralCheck: "line-general-check",
  lineGeneralChecklist3: "line-general-checklist3",
  lineGeneralCopy3: "line-general-copy-3",
  lineGeneralDownloadCloud: "line-general-download-cloud",
  lineGeneralEqual: "line-general-equal",
  lineGeneralEye: "line-general-eye",
  lineGeneralHelpCircle: "line-general-help-circle",
  lineGeneralHomeLine: "line-general-home-line",
  lineGeneralInfoCircle: "line-general-info-circle",
  lineGeneralLink1: "line-general-link-1",
  lineGeneralLinkExternal: "line-general-link-external",
  lineGeneralMinusCircle: "line-general-minus-circle",
  lineGeneralSearchMd: "line-general-search-md",
  lineGeneralSettings1: "line-general-settings-1",
  lineGeneralXCircle: "line-general-x-circle",
  lineGeneralXClose: "line-general-x-close",
  lineGeneralZap: "line-general-zap",
  lineHelpersFlag: "line-helpers-flag",
  lineHelpersPlayCircle: "line-helpers-play-circle",
  lineIconBomb2: "line-icon-bomb-2",
  lineImagesImage: "line-images-image",
  lineLayoutsColumn2: "line-layouts-columns-2",
  lineLayoutsColumns2: "line-layouts-columns-2",
  lineLayoutsLayoutTop: "line-layouts-layout-top",
  lineLayoutsMaximize2: "line-layouts-maximize-2",
  lineLayoutsMinimize2: "line-layouts-minimize-2",
  lineSecurityKey: "line-security-key",
  lineShapesDotCircle: "line-shapes-dot-circle",
  lineShapesMoon: "line-shapes-moon",
  lineShapesSun: "line-shapes-sun",
  lineShapesThemeAuto: "line-shapes-theme-auto",
  lineTimeClockStopwatch: "line-time-clock-stopwatch",
  playwrightLogo: "playwright-logo",
  reportLogo: "report-logo",
  solidAlertCircle: "solid-alert-circle",
  solidCheckCircle: "solid-check-circle",
  solidHelpCircle: "solid-help-circle",
  solidMinusCircle: "solid-minus-circle",
  solidPlusCircle: "solid-plus-circle",
  solidXCircle: "solid-x-circle",
  spinner: "spinner",
  testNew: "test-new",
  viewOff: "view-off",
  view: "view",
} as const;

export type SvgIconProps = Omit<SVGAttributes<SVGSVGElement>, "className" | "id" | "size" | "inline"> & {
  /**
   * "xs" is 12x12
   * "s" is 16x16
   * "m" size is 20x20
   * "l" size is 24x24
   * "xl" size is 32x32
   *
   * @default s
   */
  "size"?: "xs" | "s" | "m" | "l" | "xl";
  /**
   * Additional class name
   */
  "className"?: string;
  /**
   * Icon id
   *
   * @example
   * <SvgIcon id={allureIcons.lineShapesMoon} />
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
  ...restProps
}: SvgIconProps) => {
  const Icon = iconComponents[id];
  const iconClassName = clsx(styles.icon, styles[`size-${size}`], inline && styles.inline, className);

  if (typeof Icon === "function") {
    return <Icon {...restProps} className={iconClassName} data-testid={dataTestId} />;
  }

  if (typeof Icon === "string") {
    return (
      <img
        {...(restProps as JSX.HTMLAttributes<HTMLImageElement>)}
        alt=""
        className={iconClassName}
        data-testid={dataTestId}
        src={Icon}
      />
    );
  }

  return null;
};
