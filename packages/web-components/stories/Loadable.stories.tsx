import { signal } from "@preact/signals";
import type { Meta, StoryObj } from "@storybook/react";
import { Loadable } from "../";

type StoreSignalState<T> = {
  loading: boolean;
  error: string | null;
  data: T;
};

// Meta configuration
const meta: Meta<typeof Loadable<any>> = {
  title: "Commons/Loadable",
  component: Loadable,
  argTypes: {
    source: {
      control: false,
      description: "A Signal containing the state of loading, error, and data.",
    },
    transformData: {
      control: false,
      description: "Function to transform the loaded data before rendering.",
    },
    renderData: {
      control: false,
      description: "Function to render the loaded data.",
    },
    renderLoader: {
      control: false,
      description: "Function to render a custom loader during the loading state.",
    },
    renderError: {
      control: false,
      description: "Function to render a custom error message when an error occurs.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Loadable<any>>;

// Mock Data
const mockSource = signal<StoreSignalState<string>>({
  loading: false,
  error: null,
  data: "Loaded data!",
});

const mockLoadingSource = signal<StoreSignalState<string>>({
  loading: true,
  error: null,
  data: "",
});

const mockErrorSource = signal<StoreSignalState<string>>({
  loading: false,
  error: "Something went wrong!",
  data: "",
});

// Stories
export const Default: Story = {
  render: () => (
    <Loadable
      // @ts-ignore
      source={mockSource}
      renderData={(data) => <div>Data: {data}</div>}
      renderLoader={() => <div>Loading...</div>}
      renderError={(err) => <div style={{ color: "red" }}>Error: {err}</div>}
    />
  ),
};

export const LoadingState: Story = {
  render: () => (
    <Loadable
      // @ts-ignore
      source={mockLoadingSource}
      renderData={(data) => <div>Data: {data}</div>}
      renderLoader={() => <div>Loading...</div>}
      renderError={(err) => <div style={{ color: "red" }}>Error: {err}</div>}
    />
  ),
};

export const ErrorState: Story = {
  render: () => (
    <Loadable
      // @ts-ignore
      source={mockErrorSource}
      renderData={(data) => <div>Data: {data}</div>}
      renderLoader={() => <div>Loading...</div>}
      renderError={(err) => <div style={{ color: "red" }}>Error: {err}</div>}
    />
  ),
};

export const WithDataTransformation: Story = {
  render: () => (
    <Loadable
      // @ts-ignore
      source={mockSource}
      transformData={(data) => `Transformed ${data}`}
      renderData={(data) => <div>Data: {data}</div>}
      renderLoader={() => <div>Loading...</div>}
      renderError={(err) => <div style={{ color: "red" }}>Error: {err}</div>}
    />
  ),
};
