declare module "*.svg" {
  const content: {
    id: string;
  };

  export default content;
}

declare module "*.scss" {
  const content: Record<string, string>;

  export default content;
}

// export {};

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];
