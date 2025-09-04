import { type PluginGlobals } from "@allurereport/plugin-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import { type StoreSignalState } from "./types";

export const globalsStore = signal<StoreSignalState<PluginGlobals>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const fetchGlobals = async () => {
  try {
    const data = await fetchReportJsonData<PluginGlobals>("widgets/globals.json");

    globalsStore.value = {
      data,
      error: undefined,
      loading: false,
    };
  } catch (err) {
    globalsStore.value = {
      ...globalsStore.value,
      error: err.message,
      loading: false,
    };
  }
};
