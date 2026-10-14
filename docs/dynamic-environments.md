# Dynamic environments

`environments` in the config is static: every environment has to be listed upfront with a `matcher`.
When the set of environments is not known in advance (hosts, agents, stands), use `dynamicEnvironments`:
the environment is derived from the labels of each test result as it arrives, so it also works with `allure watch`
without restarting or reloading the config.

## Function form

```js
export default {
  dynamicEnvironments: ({ labels }) => labels.find(({ name }) => name === "host")?.value,
};
```

The function receives `{ labels }` and returns:

- a string — the environment id;
- `{ id, name }` — the id and a display name;
- `undefined` — the result is not matched (it goes to `default`).

The environment id `unresolved` is reserved for values which cannot be used. Declaring it in `environments`, forcing it with `environment` or returning it from the resolver is an error when `dynamicEnvironments` is used.

## Declarative form

```js
export default {
  dynamicEnvironments: {
    label: "host", // the label which holds the environment
    pattern: /^[\w-]+/, // optional: the first capture group (or the whole match) is the environment
    name: "Host {value}", // optional display name template
  },
};
```

A result without the label is not matched and goes to `default`. A result with the label whose value does not match
`pattern` goes to the `unresolved` environment, so a wrong pattern is visible in the report right away.

## Resolution order

1. `environment` from the config (forces one environment for all results).
2. Static `environments` matchers, in the order they are declared.
3. `dynamicEnvironments`.
4. `default`.

If the id returned by `dynamicEnvironments` is listed in `environments`, the configured name is used.
Ids which are not listed in `allowedEnvironments` (when it is set) are rejected like any other environment.

## Ids and names

- Characters other than latin letters, digits, `_` and `-` are replaced with `_` in the id,
  the original value is used as the name: `srv1.example.com` becomes the environment `srv1.example.com` with the id `srv1_example_com`.
- Ids are limited to 64 characters.
- Different values which end up with the same id (`a.b` and `a b`, or `a_b` and `a.b`) are rejected with an error, also for ids declared in `environments` and when several dumps are restored.
- A value which cannot be turned into an id (for example `!!!`) goes to the technical environment `unresolved`
  and a warning with the value is printed once. It is not checked against `allowedEnvironments`.
- A resolver returning something other than a string id (or `{ id, name }`) or an invalid explicit name is a bug in the config and throws.

## Things to keep in mind

- **Cardinality.** Return stable values with a small set of variants. Every distinct value becomes an environment
  in the report. Ids, timestamps or names of short-lived agents produce hundreds of environments and bloat the report.
  A warning is printed once when more than 50 dynamic environments appear. Use `pattern` to cut unstable parts
  (`/^[\w-]+/` turns `runner-7f3a9c.example.com` into `runner-7f3a9c`; use `/^runner/` to get just `runner`).
- **History and retries.** The environment is a part of the retry identity of a test. Changing the logic of the resolver
  changes the identity of the tests, so retries and the history of the previous runs will not be linked to the new results.
- **Variables.** `variables` per environment can be set only for environments listed in `environments`.
- **Removal.** Environments are never removed while the report is running, even if all their results are gone.
- **Config reload.** `allure watch` still reads the config once on start. `dynamicEnvironments` removes the need to
  edit it when new environments appear.
