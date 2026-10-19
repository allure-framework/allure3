import type { LangLocale } from "@allurereport/web-commons";
import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useState } from "preact/hooks";

import { LanguagePicker } from "@/components/LanguagePicker";

const meta: Meta<typeof LanguagePicker> = {
  title: "Components/LanguagePicker",
  component: LanguagePicker,
  parameters: {
    layout: "centered",
  },
  args: {
    locale: "en",
  },
  render: (args) => {
    const [locale, setLocale] = useState<LangLocale>(args.locale);

    return <LanguagePicker {...args} locale={locale} setLocale={setLocale} />;
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LimitedLocales: Story = {
  args: { availableLocales: ["en", "ru"] },
};
