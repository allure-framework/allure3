import { computed, signal } from "@preact/signals";

const parseHash = () => {
  const hash = globalThis.location.hash.slice(1);
  const [tabName, ...params] = hash.split("/");
  return {
    tabName: tabName || "overview",
    params: { id: params[0] || null, subId: params[1] || null },
  };
};

export const route = signal(parseHash());

const handleHashChange = () => {
  route.value = parseHash();
};

globalThis.addEventListener("hashchange", handleHashChange);

export const navigateTo = (path: string) => {
  globalThis.location.hash = path;
  handleHashChange();
};

export const openInNewTab = (path: string) => {
  window.open(`#${path}`, "_blank");
};

export const activeTab = computed(() => route.value.tabName);
