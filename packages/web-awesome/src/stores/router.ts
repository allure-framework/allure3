import { computed, signal } from "@preact/signals";

type NavigateToObject = {
  category?: string;
  params?: {
    testResultId?: string | null;
    subTab?: string | null;
  };
};

type Route = {
  category?: string;
  params?: {
    testResultId?: string | null;
    subTab?: string | null;
  };
};

export const parseHash = (): Route => {
  const hash = globalThis.location.hash.replace(/^#/, "").trim();
  const parts = hash.split("/").filter(Boolean);
  const [first, second] = parts;

  if (parts.length === 0) {
    return {};
  }

  if (parts.length === 1) {
    if (/^[a-f0-9]{32,}$/.test(first)) {
      return { params: { testResultId: first } };
    }
    return { category: first || "", params: { testResultId: second } };
  }

  if (parts.length === 2) {
    if (/^[a-f0-9]{32,}$/.test(first)) {
      return {
        params: {
          testResultId: first,
          subTab: second,
        },
      };
    }

    return {
      category: first,
      params: {
        testResultId: second,
      },
    };
  }

  if (parts.length === 3) {
    const [category, testResultId, subTab] = parts;
    return { category, params: { testResultId, subTab } };
  }

  return {};
};

export const route = signal<Route>(parseHash());

export const handleHashChange = () => {
  const newRoute = parseHash();

  if (
    newRoute.category !== route.value?.category ||
    newRoute.params?.testResultId !== route.value.params?.testResultId ||
    newRoute.params?.subTab !== route.value.params?.subTab
  ) {
    route.value = { ...newRoute };
  }
};

export const navigateTo = (path: NavigateToObject | string) => {
  let newHash = "";

  if (typeof path === "string") {
    newHash = path.startsWith("#") ? path.slice(1) : path;
  } else {
    const { category, params = {} } = path;
    const parts: string[] = [];

    if (category) {
      parts.push(category);
    }

    if (params.testResultId) {
      parts.push(params.testResultId);
    }

    if (params.subTab) {
      parts.push(params.subTab);
    }

    newHash = parts.join("/");
  }

  history.pushState(null, "", `#${newHash}`);
  handleHashChange();
};

export const openInNewTab = (path: string) => {
  window.open(`#${path}`, "_blank");
};

export const activeTab = computed(() => route.value.category || "");
export const activeSubTab = computed(() => route.value.params?.subTab || "overview");
