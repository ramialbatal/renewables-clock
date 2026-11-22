/*
 * Which energy sources and countries to show, and where the official data comes from.
 *
 * Data is fetched live in the browser from Our World in Data's grapher API,
 * which sends `Access-Control-Allow-Origin: *`, so no server is needed.
 * One chart (electricity mix, by source) gives yearly electricity
 * generation in TWh by source for every country, from Ember and the
 * Energy Institute Statistical Review of World Energy.
 *
 * To add a country, add its ISO 3166-1 alpha-3 code (OWID uses OWID_* for aggregates).
 */
window.RE_CONFIG = {
  apiBase: "https://ourworldindata.org/grapher/",
  // "electricity-prod-source-stacked" now redirects here, and the redirect has no CORS header,
  // so the final address is used directly.
  chart: "electricity-mix",
  chartParams: { frequency: "annual", metric: "by_source", source: "total" },
  // Columns of that chart. Renewables = solar + wind + hydro + bioenergy + other renewables.
  columns: {
    solar: "solar_generation__twh",
    wind: "wind_generation__twh",
    hydro: "hydro_generation__twh",
    bio: "bioenergy_stacked_generation__twh",
    otherRen: "other_renewables_generation__twh",
    nuclear: "nuclear_generation__twh",
    gas: "gas_generation__twh",
    oil: "oil_generation__twh",
    coal: "coal_generation__twh"
  },
  sources: {
    all:   { label: "Renewable", short: "All renewables", long: "renewable electricity (solar, wind, hydro, bioenergy and other renewables)",
             parts: ["solar", "wind", "hydro", "bio", "otherRen"] },
    solar: { label: "Solar", short: "Solar", long: "solar electricity", parts: ["solar"] },
    wind:  { label: "Wind", short: "Wind", long: "wind electricity", parts: ["wind"] },
    hydro: { label: "Hydro", short: "Hydro", long: "hydroelectricity", parts: ["hydro"] }
  },
  // COP28 goal: triple renewable capacity to at least 11,000 GW by 2030 (from the 2022 level).
  // Installed capacity comes from IRENA via Our World in Data's indicator API (values are end-of-year GW).
  capacity: {
    indicator: 1305907,   // IRENA "Total renewable capacity" (excludes pumped storage)
    apiBase: "https://api.ourworldindata.org/v1/indicators/",
    base: 2022,           // pledge baseline year
    target: 11000,        // GW, world, by end of targetYear
    targetYear: 2030,
    source: "IRENA, Renewable Energy Statistics"
  },
  defaultSource: "all",
  source: "Ember and Energy Institute, Statistical Review of World Energy",
  sourceUrl: "https://ourworldindata.org/renewable-energy",
  historyFrom: 2015,   // first year fetched
  trendYears: 1,       // growth trend = average annual change over the last N years (1 = latest year-on-year change)
  maxGrowth: 0.5,      // cap on the yearly growth used for projecting (50%), so tiny fast-growing bases don't run away
  world: "OWID_WRL",
  // Same countries as the Emissions Clock, so the two pages can be compared.
  countries: [
    { code: "CHN", flag: "🇨🇳" },
    { code: "USA", flag: "🇺🇸" },
    { code: "IND", flag: "🇮🇳" },
    { code: "OWID_EU27", flag: "🇪🇺", name: "European Union" },
    { code: "RUS", flag: "🇷🇺" },
    { code: "JPN", flag: "🇯🇵" },
    { code: "IRN", flag: "🇮🇷" },
    { code: "IDN", flag: "🇮🇩" },
    { code: "SAU", flag: "🇸🇦" },
    { code: "KOR", flag: "🇰🇷" },
    { code: "DEU", flag: "🇩🇪", partOf: "EU" },
    { code: "CAN", flag: "🇨🇦" },
    { code: "MEX", flag: "🇲🇽" },
    { code: "BRA", flag: "🇧🇷" },
    { code: "TUR", flag: "🇹🇷" },
    { code: "ZAF", flag: "🇿🇦" },
    { code: "AUS", flag: "🇦🇺" },
    { code: "GBR", flag: "🇬🇧" }
  ]
};
