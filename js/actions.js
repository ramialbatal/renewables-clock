// @ts-check
/**
 * "What can I do?": three actions behind a button under the answer (clock-core wireActions). One for everyday life,
 * one close to home, one to ask of leaders. Each has a source; its words are the act.<key>.t / act.<key>.x keys in
 * js/i18n/*.js (every language). Keep claims to what the source says.
 */
/** @type {import("clock-core").Action[]} */
export default [
  { icon: "☀️", key: "power", source: "IEA, World Energy Outlook 2020", url: "https://www.iea.org/reports/world-energy-outlook-2020" },
  { icon: "💡", key: "efficiency", source: "IEA, Energy Efficiency 2023", url: "https://www.iea.org/reports/energy-efficiency-2023" },
  { icon: "🗳️", key: "grids", source: "IEA, Electricity Grids and Secure Energy Transitions (2023)", url: "https://www.iea.org/reports/electricity-grids-and-secure-energy-transitions" },
];
