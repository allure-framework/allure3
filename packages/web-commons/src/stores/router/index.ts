import { computed } from "@preact/signals-core";
import { paramsToSearchParams } from "../url/helpers.js";
import { currentUrl, goTo } from "../url/index.js";

export const router = computed(() => {
  const hash = currentUrl.value.hash.startsWith("#") ? currentUrl.value.hash.slice(1) : currentUrl.value.hash;

  return {
    path: hash,
    pathParts: hash.split("/").filter(Boolean),
  } as const;
});

type NavigateTo = {
  path: string;
  keepSearchParams?: boolean;
  searchParams?: Record<string, string | string[] | number | undefined>;
  params?: Record<string, string | undefined>;
  replace?: boolean;
};

const createRouteUrl = (path: string, params: Record<string, string | undefined>) => {
  return path
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        const isOptional = part.endsWith("?");
        const paramKey = isOptional ? part.slice(1, -1) : part.slice(1);
        const value = params[paramKey];

        if (value) {
          return value.toString();
        }

        // If optional and no value, return empty string (will be filtered)
        if (isOptional) {
          return "";
        }

        // Required param without value, keep original
        return part;
      }
      return part;
    })
    .filter(Boolean)
    .join("/");
};

export const navigateTo = (to: NavigateTo) => {
  const { path, params = {}, replace = false, searchParams = {}, keepSearchParams = false } = to;
  const currentPathname = currentUrl.value.pathname;

  const newUrl = new URL(currentPathname, currentUrl.value.origin);
  const routeUrl = createRouteUrl(path, params);
  newUrl.hash = routeUrl === "" || routeUrl === "/" ? "" : `#${routeUrl}`;

  if (keepSearchParams) {
    paramsToSearchParams(currentUrl.value.params, newUrl.searchParams);
  }

  Object.entries(searchParams).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      for (const v of value) {
        newUrl.searchParams.set(key, v.toString());
      }
    }

    newUrl.searchParams.set(key, value.toString());
  });

  goTo(newUrl, { replace });
};

type Route<Params extends Record<string, string | undefined>> = {
  matches: boolean;
  params: Params;
};

export const createRoute = <Params extends Record<string, string | undefined>>(
  path: string,
  validate: (route: Route<Params>) => boolean = () => true,
): Route<Params> => {
  if (path === "/" && router.value.pathParts.length === 0) {
    return { matches: true, params: {} as Params };
  }

  const routeParts = path.split("/").filter(Boolean);
  const currentParts = router.value.pathParts;
  const params: Params = {} as Params;
  let routeIndex = 0;
  let currentIndex = 0;

  // Match route parts with current path parts
  while (routeIndex < routeParts.length && currentIndex < currentParts.length) {
    const routePart = routeParts[routeIndex];
    const currentPart = currentParts[currentIndex];

    if (routePart.startsWith(":")) {
      // Parameter: :param or :param?
      const isOptional = routePart.endsWith("?");
      const paramKey = isOptional ? routePart.slice(1, -1) : routePart.slice(1);

      (params as Record<string, string | undefined>)[paramKey] = currentPart;
      routeIndex++;
      currentIndex++;
    } else if (routePart === currentPart) {
      // Exact match for static parts
      routeIndex++;
      currentIndex++;
    } else {
      // No match
      return { matches: false, params: {} as Params };
    }
  }

  // Check if all required route parts were matched
  while (routeIndex < routeParts.length) {
    const routePart = routeParts[routeIndex];
    if (routePart.startsWith(":") && routePart.endsWith("?")) {
      // Optional parameter, set to undefined
      const paramKey = routePart.slice(1, -1);
      (params as Record<string, string | undefined>)[paramKey] = undefined;
      routeIndex++;
    } else {
      // Required part is missing
      return { matches: false, params: {} as Params };
    }
  }

  // If there are extra current parts, route doesn't match
  const matches = currentIndex === currentParts.length;

  const route = { matches, params };

  return { matches: matches && validate(route), params };
};
