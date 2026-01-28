export type ImageDiff = {
  /**
   * The name of the image diff
   */
  name?: string;
  /**
   * The expected image data encoded as base64
   */
  expected?: string;
  /**
   * The actual image data encoded as base64
   */
  actual?: string;
  /**
   * The diff image data encoded as base64
   */
  diff?: string;
};

export type DiffMode = "diff" | "actual" | "expected" | "side-by-side" | "overlay";
