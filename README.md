# Renewables Clock

**Live site: https://ramialbatal.github.io/renewables-clock/**

A static, real-time clock estimating **renewable electricity** generated so far this year for the world and major economies.
A switch at the top changes source: all renewables, solar, wind or hydro. `#solar`, `#wind` or `#hydro` in the URL opens that view directly.
It is the companion to the [Emissions Clock](https://ramialbatal.github.io/emissions-clock/) and uses the same method.

## Data

On load, the page fetches yearly electricity generation by source from
[Our World in Data's grapher API](https://ourworldindata.org/renewable-energy) (chart `electricity-mix`, by source),
which combines Ember's yearly electricity data and the Energy Institute's Statistical Review of World Energy.
The full table is downloaded (about 150 KB compressed) because the filtered download drops years with any blank cell.

Sources, countries, the trend window, the growth cap and the capacity goal are configured in `js/config.js`.

## Goal: tripling renewables by 2030

A goal section tracks the COP28 pledge to triple renewable capacity to at least 11,000 GW by 2030 (from the 2022 level).
Installed capacity (IRENA, end-of-year GW, excluding pumped storage) comes from Our World in Data's indicator API
(`api.ourworldindata.org/v1/indicators/1305907`). The bar shows capacity now (latest year extended at its latest growth)
against the target, with a marker for where an even compound path from 2022 would be today. Each country card in the
*All* view applies the same test to tripling its own 2022 capacity, as a rough guide only.

## Method

The latest reported year is projected to the current year using each country's latest year-on-year change,
capped at 50% a year so tiny fast-growing bases don't run away. That total is spread evenly across the year,
so the counters show year-to-date generation ticking in real time. This is a model, not a live measurement.
