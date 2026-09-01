import { allureIcons } from "@allurereport/web-components";
import { useMemo } from "preact/hooks";

import { useI18n } from "@/stores";
import { RESOLUTIONS } from "@/stores/treeFilters/constants";
import type { AwesomeFilterGroupSimple } from "@/stores/treeFilters/model";

import { MultipleChoiceFieldFilter } from "./BaseFilters";

const resolutionOptions = [
  { key: "issue", icon: allureIcons.lineDevBug2 },
  { key: "muted", icon: allureIcons.lineGeneralEye },
  { key: "accepted", icon: allureIcons.lineGeneralCheckCircle },
];

export const ResolutionFilter = (props: {
  group: AwesomeFilterGroupSimple;
  onChange: (group: AwesomeFilterGroupSimple) => void;
}) => {
  const { group, onChange } = props;
  const { t } = useI18n("filters");
  const options = useMemo(
    () =>
      resolutionOptions
        .filter(({ key }) => RESOLUTIONS.includes(key as (typeof RESOLUTIONS)[number]))
        .map((option) => ({
          ...option,
          label: t(`resolutions.${option.key}`),
          description: t(`description.resolution.${option.key}`),
        })),
    [t],
  );

  return (
    <MultipleChoiceFieldFilter
      group={group}
      onChange={onChange}
      options={options}
      label={t("resolution")}
      fieldKey="resolution"
      logicalOperator="OR"
      strict
      counter
      icon={allureIcons.lineDevBug2}
      testId="resolution-filter"
      onClear={() =>
        onChange({
          ...group,
          value: [],
        })
      }
    />
  );
};
