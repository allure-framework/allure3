declare module "*.svg" {
  const content: string;

  export default content;
}

declare module "*.scss" {
  const content: Record<string, string>;

  export = content;
}
