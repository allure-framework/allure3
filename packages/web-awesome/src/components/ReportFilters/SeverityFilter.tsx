import { capitalize, severityLevels } from "@allurereport/core-api";
import { allureIcons } from "@allurereport/web-components";
import { useMemo } from "preact/hooks";

import { useI18n } from "@/stores";

import { NO_SEVERITY } from "../../stores/treeFilters/constants";
import type { AwesomeFilterGroupSimple } from "../../stores/treeFilters/model";
import { MultipleChoiceFieldFilter } from "./BaseFilters";

const severityIcons: Record<string, string> = {
  blocker: allureIcons.lineArrowsChevronUpDouble,
  critical: allureIcons.lineArrowsChevronUp,
  normal: allureIcons.lineGeneralEqual,
  minor: allureIcons.lineArrowsChevronDown,
  trivial: allureIcons.lineArrowsChevronDownDouble,
  [NO_SEVERITY]: allureIcons.lineGeneralXClose,
};

const severityOptions = [...severityLevels, NO_SEVERITY];

export const SeverityFilter = (props: {
  group: AwesomeFilterGroupSimple;
  onChange: (group: AwesomeFilterGroupSimple) => void;
}) => {
  const { group, onChange } = props;
  const { t } = useI18n("filters");
  const { t: tSeverity } = useI18n("severity");
  const options = useMemo(
    () =>
      severityOptions.map((severity) => ({
        key: severity,
        icon: severityIcons[severity],
        label: capitalize(tSeverity(severity)),
      })),
    [tSeverity],
  );

  return (
    <MultipleChoiceFieldFilter
      group={group}
      onChange={onChange}
      options={options}
      label={t("severity")}
      fieldKey="severity"
      logicalOperator="OR"
      strict
      counter
      testId="severity-filter"
      onClear={() =>
        onChange({
          ...group,
          value: [],
        })
      }
    />
  );
};
