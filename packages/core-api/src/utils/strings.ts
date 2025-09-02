export const capitalize = <T extends string>(str: T): Capitalize<T> | undefined => {
  if (!str) {
    return;
  }

  return (str.charAt(0).toLocaleUpperCase() + str.slice(1)) as Capitalize<T>;
};
