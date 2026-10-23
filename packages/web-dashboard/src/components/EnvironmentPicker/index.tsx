import { EnvironmentPicker as SharedEnvironmentPicker } from "@allurereport/web-components/core";

import { currentEnvironment, environmentsStore, setCurrentEnvironment } from "@/stores/env";
import { useI18n } from "@/stores/locale";

export const EnvironmentPicker = () => {
  const { t } = useI18n("environments");
  return (
    <SharedEnvironmentPicker
      environments={environmentsStore.value.data}
      value={currentEnvironment.value}
      onChange={setCurrentEnvironment}
      labels={{ environment: t("environment", { count: 1 }), all: t("all") }}
    />
  );
};
