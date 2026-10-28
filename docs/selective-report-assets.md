# Selective report assets

Awesome and Dashboard include only the static assets needed by a completed report,
for both single-file HTML and directory output. No additional option is required.

Chart requirements come from configuration, including charts that depend on history
and currently have no data. Defaults still enable their configured chart renderers.
For Awesome, use `charts: []` to remove optional chart renderers and configure
`sections` separately when hiding the charts section. Hiding a section alone does
not redefine the chart configuration.

Awesome attachment viewers are selected from report data, including nested steps,
fixtures, retries, global attachments, and embedded historical errors. A viewer
needed only by an earlier failed attempt remains available in Retries.

Selection preserves dependency closures and licenses. Shared CSS, fonts, locales
and themes retain their existing behavior. Live reports and any lifecycle that has
received updates retain the complete asset set, including their final output.
Unknown requirements or an archive without feature metadata also retain all assets;
invalid metadata is rejected by the existing archive validation.

Directory output copies selected files through the normal report writer. Generate
into an empty directory or use `allure generate --clean` to remove assets left by
an earlier report. Without `--clean`, existing files are not automatically removed
and output size can include unused assets from previous generations. `--clean`
removes the entire output directory, including user files. Custom writers receive
the selected files and remain responsible for their own storage lifecycle.

`run --rerun` selects assets after its attempts finish. Generating from a dump uses
the restored results before selection. `open` and `serve` do not make a completed
report live. Azure-style single-file consumers retain the existing embedded loader.

Allure2 and Classic asset selection is unchanged. This mechanism reduces generated
report assets, not the published npm package or its packaged static archive.
Savings depend on configuration and report data. With default chart configuration,
all configured chart renderers remain; savings primarily come from unused viewers.
Raw JavaScript bytes, total report directory bytes and compressed single-file HTML bytes are different measurements
and should not be compared as the same size metric.
