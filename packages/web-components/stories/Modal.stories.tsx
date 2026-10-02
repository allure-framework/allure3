import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useState } from "preact/hooks";

import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

const ModalBody = ({ text }: { text: string }) => <div style={{ padding: "16px" }}>{text}</div>;

const translations = {
  tooltipPreview: "Preview",
  tooltipSyntaxHighlight: "Syntax highlighting",
  tooltipDownload: "Download",
  openInNewTabButton: "Open in new tab",
};

const meta: Meta<typeof Modal> = {
  title: "Components/Modal",
  component: Modal,
  parameters: { layout: "centered" },
  args: {
    title: "Modal title",
    translations,
    component: <ModalBody text="Modal content" />,
  },
  render: (args) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
      <>
        <Button style="outline" text="Open modal" onClick={() => setIsModalOpen(true)} />
        <Modal {...args} isModalOpen={isModalOpen} closeModal={() => setIsModalOpen(false)} />
      </>
    );
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAttachment: Story = {
  args: {
    title: undefined,
    data: {
      link: {
        id: "screenshot",
        name: "screenshot",
        ext: ".png",
        contentType: "image/png",
        originalFileName: "screenshot.png",
      },
    },
    component: <ModalBody text="Attachment preview" />,
  },
};
