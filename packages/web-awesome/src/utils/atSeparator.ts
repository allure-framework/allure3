export const ensureAtSeparator = (formatted: string, atWord: string): string => {
  const atSeparator = ` ${atWord} `;
  return formatted.includes(atSeparator) ? formatted : formatted.replace(",", ` ${atWord}`);
};
