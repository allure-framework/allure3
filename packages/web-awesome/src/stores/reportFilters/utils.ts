import { MAX_ARRAY_FIELD_VALUES } from "@allurereport/web-commons";

export const truncateArrayFieldValues = (values: string[]): string[] => {
  return values.slice(0, MAX_ARRAY_FIELD_VALUES);
};

export const getTagsFilterUrl = (tags: string[]): string => {
  const url = new URL(window.location.pathname, window.location.origin);

  tags.forEach((tag) => {
    url.searchParams.append("tags", tag);
  });


  return url.toString();
};
