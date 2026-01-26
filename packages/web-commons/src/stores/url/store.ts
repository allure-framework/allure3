import { computed, signal } from "@preact/signals-core";
import { getCurrentUrl, goTo, searchParamsToParams, subscribeToUrlChange } from "./helpers.js";

const currentUrlSignal = signal<string>(getCurrentUrl());

subscribeToUrlChange(() => {
  if (currentUrlSignal.peek() === getCurrentUrl()) {
    return;
  }

  currentUrlSignal.value = getCurrentUrl();
});

const urlSignal = computed(() => new URL(currentUrlSignal.value));
export const urlSearchParams = computed(() => urlSignal.value.searchParams);

export type Param = {
  /**
   * The key of the parameter to set
   */
  key: string;
  /**
   * The value of the parameter to set
   *
   * if `undefined`, the parameter will be deleted
   */
  value: string | string[] | undefined;
};

export const setParams = (...params: Param[]) => {
  const newUrl = new URL(getCurrentUrl());

  for (const param of params) {
    newUrl.searchParams.delete(param.key);

    if (Array.isArray(param.value)) {
      for (const value of param.value) {
        newUrl.searchParams.append(param.key, value);
      }
    } else if (typeof param.value === "string") {
      newUrl.searchParams.set(param.key, param.value);
    }
  }

  if (newUrl.href === urlSignal.peek().href) {
    return;
  }

  goTo(newUrl.href, {
    replace: true,
  });
};

export const currentUrl = computed(() => {
  return {
    hash: urlSignal.value.hash,
    pathname: urlSignal.value.pathname,
    origin: urlSignal.value.origin,
    params: searchParamsToParams(urlSearchParams.value),
  } as const;
});

export const getParamValue = (key: string) => urlSearchParams.value.get(key);
export const getParamValues = (key: string) => urlSearchParams.value.getAll(key);
export const hasParam = (key: string) => urlSearchParams.value.has(key);

export const getParamValueComputed = (key: string) => computed(() => getParamValue(key));
export const getParamValuesComputed = (key: string) => computed(() => getParamValues(key));
export const hasParamComputed = (key: string) => computed(() => hasParam(key));
