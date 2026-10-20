import type { Preview } from "@storybook/preact-vite";

import "@/assets/scss/index.scss";
import "./styles.scss";

const preview: Preview = {
  tags: ["autodocs"],
  // the theme of the components is switched in the toolbar, the semantic colors follow the attribute of the root
  globalTypes: {
    theme: {
      description: "The theme of the components",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      document.documentElement.setAttribute("data-theme", context.globals.theme === "dark" ? "dark" : "light");

      return Story();
    },
  ],
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
