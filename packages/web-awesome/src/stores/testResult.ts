import { computed } from "@preact/signals";
import { rootTabRoute, testResultRoute } from "./router";

const emptyRoute = { matches: false, params: {} as { testResultId?: string; tab?: string } };
const activeTestResultRoute = computed(() => {
  if (rootTabRoute.value.matches && rootTabRoute.value.params.testResultId) {
    return rootTabRoute.value;
  }
  if (testResultRoute.value.matches) {
    return testResultRoute.value;
  }
  return emptyRoute;
});

export const trCurrentTab = computed(() => activeTestResultRoute.value.params.tab ?? "overview");
export const currentTrId = computed(() => activeTestResultRoute.value.params.testResultId);
