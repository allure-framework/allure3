import { computed, signal, useComputed } from "@preact/signals";

const getInitialCurrentUrl = (): URL => {
  if (typeof window === "undefined") {
    return new URL("http://localhost/");
  }

  return new URL(window.location.href);
};

export const currentUrl = signal<URL>(getInitialCurrentUrl());

export const initRouterStore = () => {
  if (typeof window === "undefined") {
    return;
  }

  const handleUrlChange = () => {
    currentUrl.value = new URL(window.location.href);
  };

  window.addEventListener("popstate", handleUrlChange);
  window.addEventListener("hashchange", handleUrlChange);

  return () => {
    window.removeEventListener("popstate", handleUrlChange);
    window.removeEventListener("hashchange", handleUrlChange);
  };
};

const matchPath = (path: string, routePath: string) => {
  const pathParts = path.split("/").filter(Boolean);
  const routePathParts = routePath.split("/").filter(Boolean);

  // Paths must have the same number of parts
  if (pathParts.length !== routePathParts.length) {
    return false;
  }

  return pathParts.every((part, index) => {
    const routePart = routePathParts[index];
    if (part === routePart) {
      return true;
    }

    if (!routePart) {
      return false;
    }

    return routePart.startsWith(":");
  });
};

const extractParams = (path: string, routePath: string) => {
  const pathParts = path.split("/").filter(Boolean);
  const routePathParts = routePath.split("/").filter(Boolean);

  return pathParts.reduce<Record<string, string>>((acc, part, index) => {
    const routePart = routePathParts[index];
    if (routePart && routePart.startsWith(":")) {
      acc[routePart.slice(1)] = part;
    }

    return acc;
  }, {});
};

const alwaysTrue = () => true;

export const getRouteFromUrl = <Params extends Record<string, string>>(
  url: URL,
  routePath: string,
  validatePath: (parts: string[], params: Params) => boolean = alwaysTrue,
) => {
  const pathname = url.hash.replace(/^#/, "");
  const params = extractParams(pathname, routePath) as Params;
  const matches = matchPath(pathname, routePath) && validatePath(pathname.split("/").filter(Boolean), params);

  return {
    pathname,
    params: matches ? params : ({} as Params),
    matches,
    searchParams: url.searchParams,
  } as const;
};

type Options<Params extends Record<string, string>> = {
  validate?: (parts: string[], params: Params) => boolean;
};

export const createRoute = <Params extends Record<string, string>>(routePath: string, options?: Options<Params>) =>
  computed(() => getRouteFromUrl<Params>(currentUrl.value, routePath, options?.validate ?? alwaysTrue));

export const useRoute = <Params extends Record<string, string>>(routePath: string, options?: Options<Params>) => {
  const route = useComputed(() =>
    getRouteFromUrl<Params>(currentUrl.value, routePath, options?.validate ?? alwaysTrue),
  );

  return route;
};
