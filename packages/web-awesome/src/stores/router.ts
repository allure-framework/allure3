import { computed, signal } from "@preact/signals";

type NavigateToString = string;
type NavigateToObject = {
  id?: string | null;
  params?: {
    tabName?: string | null;
  };
};

const parseHash = () => {
  const hash = globalThis.location.hash.slice(1);
  const [id, params] = hash.split("/");
  return {
    id: id || null,
    params: params ? { tabName: params } : {},
  };
};

export const route = signal<NavigateToObject>(parseHash());

export const handleHashChange = () => {
  const newRoute = parseHash();

  if (newRoute.id !== route.value.id || newRoute.params.tabName !== route.value.params.tabName) {
    route.value = newRoute;
  }
};

export const navigateTo = (path: NavigateToString | NavigateToObject) => {
  let newHash = "";

  if (typeof path === "string") {
    newHash = path.startsWith("#") ? path.slice(1) : path;
  } else {
    const { id, params = {} } = path;

    newHash = `${id}/${params.tabName ?? ""}`;
  }
  history.pushState(null, "", `#${newHash}`);
  handleHashChange();
};

export const openInNewTab = (path: string) => {
  window.open(`#${path}`, "_blank");
};

export const activeTab = computed(() => route.value.params?.tabName || "overview");
