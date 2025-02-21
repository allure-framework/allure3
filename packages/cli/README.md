# Allure 3

**Allure 3** is the next evolution of the Allure reporting framework, rebuilt from the ground up with a new architecture and expanded capabilities. Unlike its predecessor, **Allure 2**, this version is developed in **TypeScript** and introduces a modular plugin system for greater flexibility. A key addition is the **Awesome** plugin, which delivers an enhanced UI for better report visualization.

> 🚧 **Allure 3 is currently in beta and under active development.**  
> Although not production-ready, we encourage users to install, explore, and share feedback with the development team.

The **Allure 3 CLI** provides a comprehensive suite of commands designed to streamline the generation, serving, and management of test reports.

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official annoucements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

## Key Features

Allure 3 introduces several notable improvements. The framework has been entirely rewritten in **TypeScript**, making it more extensible and easier to maintain. Its **plugin system** allows you to customize and extend reporting functionality to fit your specific needs. Configuration has been simplified with a **single file** managing all report settings, making it more convenient to handle multiple reports.

One of the standout features is **real-time reporting**, which lets you view live updates during test execution using the `watch` command. The report interface itself has been redesigned to enhance usability and clarity. Moreover, Allure 3 maintains **compatibility with the entire Allure ecosystem**, supporting all major test frameworks.

> 🚧 Please note that **official CI/CD integrations and IDE plugins are not yet available** for Allure 3.

## Installation

To install Allure 3 globally, you can use [`npm`](https://docs.npmjs.com/downloading-and-installing-packages-globally). Simply run:

```bash
npm install -g allure
```

However, we recommend using `npx` for running Allure commands without needing a global installation:

```bash
npx allure run -- <test_command>
```

This approach ensures you always use the latest version without managing global dependencies.

## Commands

### Running Tests and Generating Reports

Running tests and generating a report with Allure 3 is straightforward. Using the `run` command, you can execute your test suite and automatically generate a report:

```bash
npx allure run -- <test_command>
```

For example, if you're using `npm` as your test runner, the command would be:

```bash
npx allure run -- npm test
```

To successfully generate a report, ensure that your test setup outputs results into an `allure-results` directory, which is automatically detected by Allure 3. This directory can be placed at any nested level within your project (e.g., `out/tests/allure-results`), provided it retains the correct name.

After the tests complete, the report is generated automatically. Existing results from previous runs are ignored, as Allure 3 focuses solely on new data to ensure accurate and up-to-date reporting.

### Generating Reports Manually

If you already have test results and wish to generate a report manually, use the `generate` command:

```bash
npx allure generate <resultsDir>
```

By default, this command produces an **Allure 3 Awesome** report. You can customize output settings, such as the destination directory, through the configuration file. If you prefer a **Classic** or **Allure 2-style** report, or need to disable certain plugins, these adjustments can also be made via configuration.

### Viewing Reports

To view a previously generated report locally, the `open` command serves it in your default browser:

```bash
npx allure open <reportDir>
```

If you’ve defined the output directory in your configuration file, specifying `<reportDir>` is optional. By default, Allure 3 looks for a directory named `allure-report`. To open the Awesome report directly, point to the nested directory:

```bash
npx allure open allure-report/awesome
```

### Real-time Report Monitoring

When you need to monitor test execution live, the `watch` command provides dynamic report updates. It continuously monitors the specified results directory for changes and refreshes the report automatically:

```bash
npx allure watch <allureResultsDir>
```

This command is ideal for iterative development and debugging, allowing you to see immediate feedback as you modify and rerun tests. The browser tab updates seamlessly whenever new results are detected.

### Command-line Options

The Allure CLI includes several helpful global options. Use `--help` to explore available commands or get detailed usage information for a specific command:

```bash
npx allure run --help
npx allure watch --help
```

To check your installed version of Allure 3, use:

```bash
npx allure --version
```


## Configuration

Allure 3 uses an `allurerc.mjs` configuration file to manage report settings, including the report name, output directory, and plugin options.

> 💡 **Tip:** We recommend using the **Awesome** plugin for the best experience.  
> Support for Classic and Allure 2-style reports is currently experimental.

### Example Configuration File

```js
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report Example",
  output: "./out/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: true,
        reportLanguage: "en",
      },
    },
  },
});
```

In this example, the generated report is named *Allure Report Example* and saved to the `./out/allure-report` directory. The **Awesome** plugin is enabled with options to produce a single-file HTML report in English.

### Configuration Options

The configuration file allows you to fine-tune report generation. Key options include:

- **`name`**: Specifies the report’s display name.
- **`output`**: Defines the directory where the report will be saved.
- **`plugins`**: Enables and configures plugins, with each supporting various options.

### Awesome Plugin Options

The **Awesome** plugin offers several customizable options:

- **`singleFile`** *(boolean)*: If set to `true`, generates the report as a single standalone HTML file.
- **`reportName`** *(string)*: Overrides the default report name.
- **`open`** *(boolean)*: Automatically opens the report after generation if enabled.
- **`reportLanguage`** *(string)*: Sets the UI language of the report. Supported languages include:

  `az`, `br`, `de`, `en`, `es`, `fr`, `he`, `ja`, `kr`, `nl`, `pl`, `ru`, `sv`, `tr`, `zh`.

For example, setting `"reportLanguage": "fr"` will render the report interface in French.

## Final Notes

Allure 3 represents a significant step forward in test reporting, offering improved performance, flexibility, and an enhanced user interface. While it remains in beta, the framework is stable enough for exploration and feedback. We encourage you to experiment with the **Awesome** plugin and share your insights to help us refine the experience.

Stay updated with the latest features, and don’t hesitate to contribute or report issues. Together, we can make Allure 3 the best it can be!
