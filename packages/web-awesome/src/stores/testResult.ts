import { computed } from "@preact/signals";
import { testResultRoute } from "./routes";

export const testResultIdStore = computed(() => testResultRoute.value.params.testResultId ?? null);

const DEFAULT_TAB = "overview";

export const trTabStore = computed(() => testResultRoute.value.params.trTab ?? DEFAULT_TAB);
