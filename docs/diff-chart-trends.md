# Trends for changes in test status and test base

The status transitions and test base growth charts in Awesome and Dashboard
show two trend lines over the visible runs. Both include runs with zero net
change.

- **Cumulative trend (solid)** shows the direction of the fitted running total
  within the visible window. The slope can differ from the sign of the final
  net change. For example, changes of 10, −10, −10, and 11 sum to +1, but their
  running total has a downward fitted slope.
- **Per-run change trend (dashed)** shows how the net change per run is moving.
  For example, if the cumulative trend rises while the per-run trend falls,
  the test base can still be growing even as its growth slows.

For each run, the net change is fixed tests minus regressed and malfunctioned
tests, or added tests minus removed tests for the statuses shown in the chart.
The dashed line fits these changes directly. The solid line fits their running
total divided by the number of displayed comparisons, including the current
run. This normalization lets the line share the chart with the bars. Read its
slope for direction. The line height is a scaled value.
