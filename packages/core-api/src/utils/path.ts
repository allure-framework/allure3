export const toPosixPath = (path: string) => path.replace(/\\/g, "/");

export const joinPosixPath = (...parts: string[]) => {
  const segments = parts.map(toPosixPath).join("/").split("/");
  const nonEmptySegments: string[] = [];

  for (const segment of segments) {
    if (segment.length > 0) {
      nonEmptySegments.push(segment);
    }
  }

  return nonEmptySegments.join("/");
};
