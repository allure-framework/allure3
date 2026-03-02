/**
 * Lightweight helper used by page objects (e.g. Tree). Kept separate from utils/index.ts
 * so that frontend-backend tests do not pull in @allurereport/core and other heavy deps.
 */
export const randomNumber = (min: number, max: number): number => {
  if (min > max) {
    [min, max] = [max, min];
  }
  return Math.floor(Math.random() * (max - min + 1) + min);
};
