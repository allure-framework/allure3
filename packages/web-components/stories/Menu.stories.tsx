import type { Meta, StoryObj } from "@storybook/react";
import { Menu, Text } from "../";

const meta: Meta<typeof Menu> = {
  title: "Commons/Menu",
  component: Menu,
  argTypes: {
    isInitialOpened: {
      control: "boolean",
      description: "Controls whether the menu is open initially.",
    },
    size: {
      control: { type: "select" },
      options: ["s", "m", "l", "xl"],
      description: "Sets the size of the menu.",
    },
    placement: {
      control: { type: "select" },
      options: ["bottom-start", "bottom-end"],
      description: "Controls the placement of the menu relative to the trigger.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Menu>;

export const DefaultMenu: Story = {
  args: {
    isInitialOpened: false,
    size: "m",
    placement: "bottom-end",
    // @ts-ignore
    menuTrigger: ({ onClick, isOpened }) => <button onClick={onClick}>{isOpened ? "Close Menu" : "Open Menu"}</button>,
  },
  render: (args) => (
    <Menu {...args}>
      <Menu.Section>
        <Menu.Item onClick={() => alert("Item 1 clicked")}>Item 1</Menu.Item>
        <Menu.Item onClick={() => alert("Item 2 clicked")}>Item 2</Menu.Item>
      </Menu.Section>
      <Menu.Section>
        <Menu.ItemWithCheckmark isChecked={true} onClick={() => alert("Item with checkmark clicked")}>
          Checked Item
        </Menu.ItemWithCheckmark>
        <Menu.ItemWithCheckmark isChecked={false} onClick={() => alert("Unchecked Item clicked")}>
          Unchecked Item
        </Menu.ItemWithCheckmark>
      </Menu.Section>
    </Menu>
  ),
};

// @ts-ignore
export const WithCustomPlacement: Story = {
  args: {
    isInitialOpened: false,
    size: "m",
    placement: "bottom-start",
    // @ts-ignore
    menuTrigger: ({ onClick, isOpened }) => <button onClick={onClick}>{isOpened ? "Close Menu" : "Open Menu"}</button>,
  },
  render: (args) => (
    <Menu {...args}>
      <Menu.Section>
        <Menu.Item onClick={() => alert("Item 1 clicked")}>Item 1</Menu.Item>
        <Menu.Item onClick={() => alert("Item 2 clicked")}>Item 2</Menu.Item>
      </Menu.Section>
    </Menu>
  ),
};

export const WithIcons: Story = {
  args: {
    isInitialOpened: false,
    size: "m",
    placement: "bottom-end",
    // @ts-ignore
    menuTrigger: ({ onClick, isOpened }) => <button onClick={onClick}>{isOpened ? "Close Menu" : "Open Menu"}</button>,
  },
  render: (args) => (
    <Menu {...args}>
      <Menu.Section>
        <Menu.Item leadingIcon="icon-id-1" onClick={() => alert("Item 1 clicked")}>
          Item with Icon 1
        </Menu.Item>
        <Menu.Item leadingIcon="icon-id-2" onClick={() => alert("Item 2 clicked")}>
          Item with Icon 2
        </Menu.Item>
      </Menu.Section>
    </Menu>
  ),
};

export const CustomContent: Story = {
  args: {
    isInitialOpened: true,
    size: "xl",
    placement: "bottom-start",
    // @ts-ignore
    menuTrigger: ({ onClick, isOpened }) => <button onClick={onClick}>{isOpened ? "Close Menu" : "Open Menu"}</button>,
  },
  render: (args) => (
    <Menu {...args}>
      <Menu.Section>
        <Menu.Item>Custom Content</Menu.Item>
        <Menu.Item>
          <Text size="m" type="paragraph">
            This is custom text inside the menu.
          </Text>
        </Menu.Item>
      </Menu.Section>
    </Menu>
  ),
};
