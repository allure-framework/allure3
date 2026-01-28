export const calculateSingleImageSize = (sizes: {
  diff: number;
  actual: number;
  expected: number;
  containerSize: number;
}) => {
  const { diff, actual, expected, containerSize } = sizes;

  return Math.min(...[diff, actual, expected, containerSize].filter((size) => size > 0));
};
