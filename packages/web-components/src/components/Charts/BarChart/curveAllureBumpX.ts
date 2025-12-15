import type { curveBumpX } from "d3-shape";

type Context = Parameters<typeof curveBumpX>[0];

class AllureBumpX {
  #context: Context;
  #line: number = NaN;
  #currentPoint: number = 0;
  #x0: number = 0;
  #y0: number = 0;
  #sharpness: number;

  constructor(context: Context, sharpness: number = 0.5) {
    this.#context = context;
    this.#sharpness = sharpness;
  }

  areaStart() {
    this.#line = 0;
  }

  areaEnd() {
    this.#line = NaN;
  }

  lineStart() {
    this.#currentPoint = 0;
  }

  lineEnd() {
    if (this.#line || (this.#line !== 0 && this.#currentPoint === 1)) {
      this.#context.closePath();
    }
    this.#line = 1 - this.#line;
  }

  point(x: number, y: number) {
    x = +x;
    y = +y;

    switch (this.#currentPoint) {
      case 0: {
        this.#currentPoint = 1;
        if (this.#line) {
          this.#context.lineTo(x, y);
        } else {
          this.#context.moveTo(x, y);
        }
        break;
      }
      case 1:
        this.#currentPoint = 2; // falls through
      // eslint-disable-next-line no-fallthrough
      default: {
        // Control points for cubic Bezier curve
        // sharpness controls where the curve "bends"
        const cp1x = this.#x0 + (x - this.#x0) * this.#sharpness;
        const cp2x = this.#x0 + (x - this.#x0) * this.#sharpness;
        this.#context.bezierCurveTo(cp1x, this.#y0, cp2x, y, x, y);
        break;
      }
    }

    this.#x0 = x;
    this.#y0 = y;
  }
}

/**
 * Creates an Allure BumpX curve factory with configurable sharpness.
 * Sharpness controls where the curve bends between points:
 * - 0 = sharp transition (curve changes immediately after leaving previous point)
 * - 0.5 = symmetric curve (standard curveBumpX behavior)
 * - 1 = gradual transition (curve holds previous value longer)
 */
export const curveAllureBumpX = (sharpness: number = 0.5) => {
  return (context: Context) => new AllureBumpX(context, sharpness);
};
