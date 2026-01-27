import { allureIcons } from "@allurereport/web-components";
import { useMemo } from "preact/hooks";
import { useI18n } from "@/stores";
import type { AwesomeFilterGroupSimple } from "../../stores/treeFilters/model";
import { MultipleChoiceFieldFilter } from "./BaseFilters";

const transitionOptions = [
  { key: "new", icon: allureIcons.lineAlertsNew },
  { key: "fixed", icon: allureIcons.lineAlertsFixed },
  { key: "regressed", icon: allureIcons.lineAlertsRegressed },
  { key: "malfunctioned", icon: allureIcons.lineAlertsMalfunctioned },
];

export const TransitionFilter = (props: {
  group: AwesomeFilterGroupSimple;
  onChange: (group: AwesomeFilterGroupSimple) => void;
}) => {
  const { group, onChange } = props;
  const { t } = useI18n("filters");
  const options = useMemo(
    () =>
      transitionOptions.map((option) => ({
        ...option,
        label: t(option.key),
        description: t(`description.${option.key}`),
      })),
    [t],
  );

  return (
    <MultipleChoiceFieldFilter
      group={group}
      onChange={onChange}
      options={options}
      label={t("transition")}
      fieldKey="transition"
      logicalOperator="OR"
      strict
      counter
      testId="transition-filter"
      onClear={() =>
        onChange({
          ...group,
          value: [],
        })
      }
    />
  );
};
