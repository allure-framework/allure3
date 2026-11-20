# Trends for changes in test status and test base

The status transitions and test base growth charts in Awesome and Dashboard show
two trend lines over the visible runs. Read their slopes from left to right.

| Chart | Line | Rising | Falling | Flat |
| --- | --- | --- | --- | --- |
| Test base growth | Cumulative (solid) | The test base is growing. | The test base is shrinking. | The test base size is stable. |
| Test base growth | Per-run change (dashed) | Growth is speeding up or shrinkage is slowing down. | Growth is slowing down or shrinkage is speeding up. | The rate of growth or shrinkage is steady. |
| Status transitions | Cumulative (solid) | Test status is improving overall. | Test status is deteriorating overall. | Test status is stable overall. |
| Status transitions | Per-run change (dashed) | Improvement is speeding up or deterioration is slowing down. | Improvement is slowing down or deterioration is speeding up. | The rate of improvement or deterioration is steady. |

For each run, the net change is fixed tests minus regressed and malfunctioned
tests, or added tests minus removed tests for the statuses shown in the chart.
The dashed line is a linear fit of these changes. The solid line is a linear fit
of the running totals divided by the number of displayed comparisons. This
scaling keeps the accumulation inside the plot area without expanding the bar
chart's Y-axis to the full running total. The growth chart tooltip shows the
cumulative fitted value before scaling.

The fitted slope uses the whole window. For example, net changes of
10, −10, −10, and 11 sum to +1, while their running total has a downward slope.
