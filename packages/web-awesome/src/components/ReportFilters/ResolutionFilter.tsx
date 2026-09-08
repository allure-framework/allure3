import { allureIcons } from "@allurereport/web-components";
import { useComputed } from "@preact/signals";
import type { AwesomeTree } from "types";

import { useI18n } from "@/stores";
import { currentEnvironment } from "@/stores/env";
import { treeStore } from "@/stores/tree";
import { RESOLUTIONS } from "@/stores/treeFilters/constants";
import type { AwesomeFilterGroupSimple } from "@/stores/treeFilters/model";

import { MultipleChoiceFieldFilter } from "./BaseFilters";

const resolutionOptions = [
  { key: "issue", icon: allureIcons.lineDevBug2 },
  { key: "muted", icon: allureIcons.lineGeneralEye },
  { key: "accepted", icon: allureIcons.lineGeneralCheckCircle },
];

const emptyResolutionCounts = Object.freeze({ issue: 0, muted: 0, accepted: 0 });

const getResolutionCounts = (
  trees: Record<string, AwesomeTree> | undefined,
  selectedEnvironment: string,
): Record<(typeof RESOLUTIONS)[number], number> => {
  if (!trees) {
    return emptyResolutionCounts;
  }

  const envIds = selectedEnvironment ? [selectedEnvironment] : Object.keys(trees);
  const counts = { issue: 0, muted: 0, accepted: 0 };

  for (const envId of envIds) {
    const leaves = Object.values(trees[envId]?.leavesById ?? {});

    for (const leaf of leaves) {
      if (leaf.resolution && leaf.resolution in counts) {
        counts[leaf.resolution] += 1;
      }
    }
  }

  return counts;
};

export const ResolutionFilter = (props: {
  group: AwesomeFilterGroupSimple;
  onChange: (group: AwesomeFilterGroupSimple) => void;
}) => {
  const { group, onChange } = props;
  const { t } = useI18n("filters");
  const resolutionCounts = useComputed(() => getResolutionCounts(treeStore.value.data, currentEnvironment.value));
  const options = resolutionOptions
    .filter(({ key }) => RESOLUTIONS.includes(key as (typeof RESOLUTIONS)[number]))
    .map((option) => ({
      ...option,
      label: t(`resolutions.${option.key}`),
      description: t(`description.resolution.${option.key}`),
      count: resolutionCounts.value[option.key as (typeof RESOLUTIONS)[number]],
    }));

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
