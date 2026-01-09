import { computed, signal } from "@preact/signals";
import { loadableStore } from "../loadableStore/index.js";
import { persistSignal, restoreSignal } from "../persister/index.js";

export const environmentsStore = loadableStore<string[]>({ initialState: [] });
export const cEnvironments = signal<string[]>([]);
export const selectedEnvironment = signal<string>("");

restoreSignal({ signal: cEnvironments, key: "collapsedEnvironments", defaultValue: [] });
persistSignal({ signal: cEnvironments, key: "collapsedEnvironments" });

export const collapsedEnvironments = computed(() => cEnvironments.value);
export const currentEnvironment = computed(() => {
  // Until the environments are loaded, use the selected environment
  if (environmentsStore.value.loading.value === false) {
    return selectedEnvironment.value;
  }

  const availableEnvironments = environmentsStore.value.data.value ?? [];

  if (availableEnvironments.includes(selectedEnvironment.value)) {
    return selectedEnvironment.value;
  }

  return "";
});

persistSignal({ signal: currentEnvironment, key: "currentEnvironment" });
restoreSignal({ signal: selectedEnvironment, key: "currentEnvironment", defaultValue: "" });
