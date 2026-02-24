export const toPosixPath = (path: string) => path.replace(/\\/g, "/");

export const joinReportPath = (...parts: string[]) =>
  parts
    .map(toPosixPath)
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");

export const getPosixPath = toPosixPath;
