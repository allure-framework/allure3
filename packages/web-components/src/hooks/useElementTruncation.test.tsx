import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, expect, it } from "vite-plus/test";

import { useElementTruncation } from "./useElementTruncation";

afterEach(cleanup);

const TruncationProbe = ({ axis }: { axis?: "horizontal" | "vertical" | "both" }) => {
  const { ref, isTruncated } = useElementTruncation([], { axis });

  return (
    <div>
      <span ref={ref} data-testid="text">
        Label
      </span>
      <output>{String(isTruncated)}</output>
    </div>
  );
};

it("measures the text independently of sibling overflow and honors changes to the axis", () => {
  const { rerender } = render(<TruncationProbe />);
  const text = screen.getByTestId("text");
  let scrollWidth = 100;
  let scrollHeight = 16;
  Object.defineProperties(text, {
    clientWidth: { value: 100 },
    scrollWidth: { get: () => scrollWidth },
    clientHeight: { value: 16 },
    scrollHeight: { get: () => scrollHeight },
  });
  Object.defineProperties(text.parentElement!, {
    clientWidth: { value: 120 },
    scrollWidth: { value: 124 },
    clientHeight: { value: 16 },
    scrollHeight: { value: 20 },
  });

  fireEvent(window, new Event("resize"));
  expect(screen.getByRole("status").textContent).toBe("false");

  // The default still detects vertical clipping for consumers of the shared hook.
  scrollHeight = 18;
  fireEvent(window, new Event("resize"));
  expect(screen.getByRole("status").textContent).toBe("true");

  rerender(<TruncationProbe axis="horizontal" />);
  expect(screen.getByRole("status").textContent).toBe("false");

  scrollWidth = 140;
  fireEvent(window, new Event("resize"));
  expect(screen.getByRole("status").textContent).toBe("true");

  scrollWidth = 100;
  fireEvent(window, new Event("resize"));
  expect(screen.getByRole("status").textContent).toBe("false");
});
