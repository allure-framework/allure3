import { computed } from "@preact/signals";
import { testResultRoute } from "./router";

export const trCurrentTab = computed(() => testResultRoute.value.params.tab ?? "overview");
export const currentTrId = computed(() => testResultRoute.value.params.testResultId);
