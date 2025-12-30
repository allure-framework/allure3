declare module "d3-regression" {
  export interface RegressionResult extends Array<[number, number]> {
    a: number; // slope
    b: number; // intercept
    predict: (x: number) => number;
    rSquared: number;
  }

  export interface RegressionLinear<T> {
    (data: T[]): RegressionResult;
    x(): (d: T) => number;
    x(fn: (d: T) => number): this;
    y(): (d: T) => number;
    y(fn: (d: T) => number): this;
    domain(): [number, number] | null;
    domain(domain: [number, number] | null): this;
  }

  export function regressionLinear<T = [number, number]>(): RegressionLinear<T>;
}
