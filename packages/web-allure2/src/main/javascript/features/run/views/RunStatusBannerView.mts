import "./RunStatusBannerView.scss";
import { defineMountableElement } from "../../../core/view/elementView.mts";
import translate from "../../../helpers/t.mts";
import { createElement } from "../../../shared/dom.mts";
import { createIconElement } from "../../../shared/icon/index.mts";
import { effectiveExitCode } from "../model/runStatus.mts";

type GlobalsData = import("../../../types/report.mts").GlobalsData;
type SummaryData = import("../../../types/report.mts").SummaryData;

type RunStatusBannerOptions = {
  globals: GlobalsData;
  summary: SummaryData;
};

const RunStatusBannerView = ({ globals, summary }: RunStatusBannerOptions) => {
  const el = defineMountableElement(document.createElement("section"), {});

  Object.assign(el, {
    render() {
      const errorCount = globals.errors.length;
      const total = summary.statistic?.total || 0;
      const passed = summary.statistic?.passed || 0;
      const firstError = globals.errors[0];
      const remainingErrors = Math.max(0, errorCount - 1);
      const exitCodeValue = effectiveExitCode(globals.exitCode);
      const hasErrors = errorCount > 0;

      const title = hasErrors
        ? translate(total === 0 ? "run.failedBeforeTests" : "run.completedWithErrors")
        : translate("run.failedWithExitCode", { hash: { code: exitCodeValue } });

      const description = hasErrors
        ? total > 0 && passed === total
          ? translate("run.allTestsPassedWithErrors", {
              hash: { count: errorCount, tests: total },
            })
          : translate("run.errorsOutsideTests", { hash: { count: errorCount } })
        : total > 0 && passed === total
          ? translate("run.allTestsPassedWithExitCode", {
              hash: { code: exitCodeValue, tests: total },
            })
          : translate("run.exitCodeUnsuccessful", { hash: { code: exitCodeValue } });

      el.className = "run-status-banner island";
      el.setAttribute("role", "alert");
      el.replaceChildren(
        createElement("div", {
          className: "run-status-banner__icon",
          children: createIconElement("solidAlertCircle", { size: "l" }),
        }),
        createElement("div", {
          className: "run-status-banner__body",
          children: [
            createElement("h2", {
              className: "run-status-banner__title",
              text: title,
            }),
            createElement("p", {
              className: "run-status-banner__description",
              text: description,
            }),
            hasErrors && firstError?.message
              ? createElement("p", {
                  className: "run-status-banner__first-error",
                  children: [
                    firstError.message,
                    remainingErrors ? ` ${translate("run.moreErrors", { hash: { count: remainingErrors } })}` : null,
                  ],
                })
              : null,
          ],
        }),
        createElement("a", {
          attrs: {
            "data-ga4-event": "run_details_click",
            "href": "#run",
          },
          className: "run-status-banner__link link",
          children: [
            translate("run.reviewDetails"),
            createIconElement("lineArrowsChevronRight", { inline: true, size: "s" }),
          ],
        }),
      );

      return el;
    },
  });

  return el;
};

export default RunStatusBannerView;
