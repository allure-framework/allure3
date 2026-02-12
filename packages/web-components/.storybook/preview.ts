import type { Preview } from "@storybook/preact";
import "@/assets/scss/index.scss";
import "./styles.scss";

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
