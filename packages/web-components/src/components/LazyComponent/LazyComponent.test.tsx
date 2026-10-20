import { cleanup, fireEvent, render, waitFor } from "@testing-library/preact";
import { useEffect } from "preact/hooks";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { LazyComponent } from "./index";

afterEach(cleanup);

it("retries a rejected loader and preserves the successful renderer when props change", async () => {
  const mounted = vi.fn();
  const Component = ({ text }: { text: string }) => {
    useEffect(() => {
      mounted();
    }, []);
    return <div>{text}</div>;
  };
  const loader = vi
    .fn()
    .mockRejectedValueOnce(new Error("chunk unavailable"))
    .mockResolvedValue({ default: Component });
  const props = { loader, fallback: "Loading", errorMessage: "Ошибка загрузки", retryLabel: "Повторить" };
  const view = render(<LazyComponent {...props} componentProps={{ text: "first" }} />);
  await waitFor(() => expect(view.getByText("Ошибка загрузки")).toBeTruthy());
  fireEvent.click(view.getByRole("button", { name: "Повторить" }));
  await waitFor(() => expect(view.getByText("first")).toBeTruthy());
  expect(loader).toHaveBeenCalledTimes(2);
  view.rerender(<LazyComponent {...props} componentProps={{ text: "second" }} />);
  expect(view.getByText("second")).toBeTruthy();
  expect(loader).toHaveBeenCalledTimes(2);
  expect(mounted).toHaveBeenCalledTimes(1);
});

it("reopens the same renderer after a failed import without reloading the page", async () => {
  const loader = vi
    .fn()
    .mockRejectedValueOnce(new Error("chunk unavailable"))
    .mockResolvedValue({ default: () => <div>reopened</div> });
  const props = { loader, componentProps: {}, fallback: "Loading", errorMessage: "Failed", retryLabel: "Retry" };
  const view = render(<LazyComponent {...props} />);
  await waitFor(() => expect(view.getByText("Failed")).toBeTruthy());
  view.unmount();
  const reopened = render(<LazyComponent {...props} />);
  await waitFor(() => expect(reopened.getByText("reopened")).toBeTruthy());
  expect(loader).toHaveBeenCalledTimes(2);
});
