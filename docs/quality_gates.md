# Quality gates

## Configuration

You can use quality gates to enforce certain quality standards on your test results.

To enable quality gates, you need to configure them in the Allure configuration file (e.g., `allurerc.js`):

```js
import { defineConfig } from "allure";

export default defineConfig({
  qualityGate: {
    rules: [
      // first ruleset allows to have up to 10 failed tests in total, it won't fail in runtime and will report validation result in the end
      {
        maxFailures: 10,
      },
      // second ruleset fails immediately if there is at least one critical test failure
      {
        // use id field to make ruleset's rules easier to identify
        id: "another-set",
        maxFailures: 0,
        fastFail: true,
        // validate only test results with critical severity label
        filter: (tr) => tr.labels.some((label) => label.name === "severity" && label.value === "critical"),
      },
    ],
  },
});
```

## Using external rules

You can use external quality gate rules implemented by the community – just provide them to the `use` field in the quality gate configuration:

```js
import { defineConfig } from "allure";
import { rule1, rule2 } from "custom-rules-package"

export default defineConfig({
  qualityGate: {
    rules: [
      // define rulesets according the external rules signature
    ],
    use: [rule1, rule2],
  },
});
```

> [!IMPORTANT]  
> When you want to use default and external rules together, don't forget to import default rules from the `allure/rules` package and include them in the `use` array:

```js
import { defineConfig } from "allure";
// import default rules at once
import { qualityGateDefaultRules } from "allure/rules"
// or import them separately
import { maxFailuresRule, minTestsCountRule, successRateRule } from "allure/rules"
import { rule1, rule2 } from "custom-rules-package"

export default defineConfig({
  qualityGate: {
    rules: [
      // define rulesets according the external rules signature
    ],
    use: [...qualityGateDefaultRules, rule1, rule2],
  },
});
```

If you don't re-assign `use` field, Allure will use only the default rules automatically without additional imports.

## Authoring custom rules

You can create your own quality gate rules by implementing the `QualityGateRule` interface. 

Below is an example of a custom quality gate rule that checks if the number of test results matches an expected value:

```ts
import type { QualityGateRule } from "allure/rules";

export const myRule: QualityGateRule<number> = {
  rule: "myRule",
  message: ({ expected, actual }) => `The custom rule has failed. Expected: ${expected} doesn't equal to ${actual}`,
  validate: async ({ trs, expected }) => {
    const actual = trs.length;
    const passed = actual === expected;

    return {
      success: actual === expected,
      actual,
    };
  }
}
```

You can also aggregate validation data in runtime to make more complex rules.

The rule below accumulates the number of test results across multiple invocations and checks if the total matches the expected value:

```ts
import type { QualityGateRule } from "allure/rules";

export const myRule: QualityGateRule<number> = {
  rule: "myRule",
  message: ({ expected, actual }) => `The custom rule has failed. Expected: ${expected} doesn't equal to ${actual}`,
  validate: async ({ trs, expected, state }) => {
    // there is no initial value in the state, so we use 0 as a fallback
    const previous = state.getResult() ?? 0;
    const actual = previous + trs.length;
    const passed = actual === expected;
    
    state.setResult(actual);

    return {
      success: actual === expected,
      actual,
    };
  }
}
```

Then, you can register your custom rule in the Allure configuration file:

```js
import { defineConfig } from "allure";
import { myRule } from "./myRule";

export default defineConfig({
  name: "Allure Report 3",
  qualityGate: {
    rules: [
      {
        myRule: 100,
      },
    ],
    use: [myRule],
  },
});
```

> [!IMPORTANT]  
> If you're using TypeScript, ensure that you compiled your custom rule file before use! Allure doesn't support on-the-fly TypeScript compilation.

## Rules custom messages

You can customize any rule message. To do this, provide a new `message` function to the specific rule in `use` array:

```js
import { defineConfig } from "allure";
import { myRule } from "./myRule";

export default defineConfig({
  name: "Allure Report 3",
  qualityGate: {
    rules: [
      {
        myRule: 100,
      },
    ],
    use: [
      {
        // don't forget to use rest spread operator to keep rest rule's fields intact
        ...myRule,
        message: ({ expected, actual }) => `Custom message: expected ${expected}, got ${actual}`,
      }
    ],
  },
});
```

## Using env variables in rules configuration

Allure Runtime configuration file is a plain JavaScript so you can use environment variables to configure quality gate rules dynamically:

```js
import { defineConfig } from "allure";
import { myRule } from "./myRule";

const { MY_RULE_VALUE } = process.env;

export default defineConfig({
  name: "Allure Report 3",
  qualityGate: {
    rules: [
      {
        // use 100 as a fallback value when env variable is not set
        myRule: Number(MY_RULE_VALUE) || 100,
      },
    ],
    use: [myRule],
  },
});
```
