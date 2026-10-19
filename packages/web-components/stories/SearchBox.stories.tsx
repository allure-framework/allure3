import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useState } from "preact/hooks";

import { SearchBox } from "@/components/SearchBox";

const meta: Meta<typeof SearchBox> = {
  title: "Commons/SearchBox",
  component: SearchBox,
  argTypes: {
    placeholder: {
      control: "text",
      description: "Placeholder text for the search input.",
      defaultValue: "Search...",
    },
    value: {
      control: "text",
      description: "Current value of the search input.",
      defaultValue: "",
    },
    error: {
      control: "text",
      description: "Error message displayed under the input.",
    },
    changeDebounce: {
      control: "number",
      description: "Debounce time for the onChange callback (in milliseconds).",
      defaultValue: 300,
    },
  },
};

export default meta;
type Story = StoryObj<typeof SearchBox>;

export const Default: Story = {
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState("");

    return (
      <SearchBox
        {...args}
        value={value}
        onChange={(newValue) => {
          setValue(newValue);
          console.log("Search value:", newValue);
        }}
      />
    );
  },
};

export const WithPlaceholder: Story = {
  args: {
    placeholder: "Search for items...",
    value: "",
  },
  render: (args) => {
    const [value, setValue] = useState("");

    return (
      <SearchBox
        {...args}
        value={value}
        onChange={(newValue) => {
          setValue(newValue);
          console.log("Search value:", newValue);
        }}
      />
    );
  },
};

export const WithInitialValue: Story = {
  args: {
    placeholder: "Search here...",
    value: "Initial Value",
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <SearchBox
        {...args}
        value={value}
        onChange={(newValue) => {
          setValue(newValue);
          console.log("Search value:", newValue);
        }}
      />
    );
  },
};

export const DebouncedSearch: Story = {
  args: {
    placeholder: "Type to search...",
    changeDebounce: 1000,
    value: "",
  },
  render: (args) => {
    const [value, setValue] = useState("");

    return (
      <SearchBox
        {...args}
        value={value}
        onChange={(newValue) => {
          setValue(newValue);
          console.log("Debounced value:", newValue);
        }}
      />
    );
  },
};

export const WithError: Story = {
  render: (args) => {
    const [value, setValue] = useState("[");

    return <SearchBox {...args} value={value} onChange={setValue} error="Invalid regular expression" />;
  },
};

export const WithSlots: Story = {
  render: (args) => {
    const [value, setValue] = useState("");

    return (
      <SearchBox
        {...args}
        value={value}
        onChange={setValue}
        placeholder="Search tests"
        leadingSlot={<span aria-hidden>🔍</span>}
        trailingSlot={<span aria-hidden>⌘K</span>}
      />
    );
  },
};
