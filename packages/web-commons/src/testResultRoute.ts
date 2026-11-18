/** Returns the result ID from a public deep link, without matching report sections. */
export const parseTestResultRoute = (hash: string): string | undefined => {
  const path = hash.replace(/^#/, "").replace(/^\//, "");
  const direct = /^testresult\/([^/?#]+)\/?$/.exec(path);

  return direct?.[1] ?? /^([a-f0-9]{32})\/?$/i.exec(path)?.[1];
};
