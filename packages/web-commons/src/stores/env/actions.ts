import { fetchReportJsonData } from "../../data.js";
import { cEnvironments, environmentsStore, selectedEnvironment } from "./store.js";

export const setCurrentEnvironment = (env: string) => {
  selectedEnvironment.value = env;
};

export const setCollapsedEnvironments = (envs: string[]) => {
  cEnvironments.value = envs;
};

export const toggleCollapsedEnvironment = (env: string) => {
  cEnvironments.value = cEnvironments.peek().includes(env)
    ? cEnvironments.peek().filter((e) => e !== env)
    : [...cEnvironments.peek(), env];
};

export const fetchEnvironments = async (silent = false) => {
  environmentsStore.onLoad(silent);

  try {
    const res = await fetchReportJsonData<string[]>("widgets/environments.json", { bustCache: true });

    environmentsStore.onSuccess(res);
  } catch (e) {
    environmentsStore.onError(e instanceof Error ? e : undefined);
  }
};
