declare module "*.svg" {
  const content: {
    id: string;
  };

  export default content;
}

declare module "*.scss" {
  const content: Record<string, string>;

  export = content;
}
