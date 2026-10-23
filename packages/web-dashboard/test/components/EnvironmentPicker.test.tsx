// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, expect, it } from "vite-plus/test";

import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import { currentEnvironment, environmentsStore } from "@/stores/env";

afterEach(cleanup);

it("wires the environment menu to the product store", async () => {
  currentEnvironment.value = "one";
  environmentsStore.value = {
    loading: false,
    error: undefined,
    data: [
      { id: "one", name: "First" },
      { id: "two", name: "Second" },
    ],
  };
  render(<EnvironmentPicker />);
  expect(screen.getByTestId("environment-picker-button").textContent).toBe("First");
  fireEvent.click(screen.getByTestId("environment-picker-button"));
  fireEvent.click(await screen.findByText("Second"));
  await waitFor(() => expect(currentEnvironment.value).toBe("two"));
  expect(screen.getByTestId("environment-picker-button").textContent).toBe("Second");
});
