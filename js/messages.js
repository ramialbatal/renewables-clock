// @ts-check
/**
 * Renewables Clock: the plain-language messages shown to visitors. Pure functions, unit tested.
 * Each returns a clock-core Message (tone, icon, short title, one sentence). Keep them short and free of jargon;
 * numbers and method details belong behind "More".
 */
import { shown, shownSign, fmt, pct, message } from "clock-core";

/** @typedef {import("clock-core").Message} Message */
/** @typedef {import("clock-core").Tone} Tone */

/**
 * The one-line answer at the top of the "All renewables" view, from the tripling-goal verdict.
 * Until capacity data arrives, falls back to whether clean power is growing.
 * @param {string | null} goalText  "Tripled", "On track", "Close", "Off track", "Going backwards", or null if unknown
 * @param {number} growth           world renewable generation, yearly change (0.086 = +8.6%)
 * @param {number} targetYear
 * @returns {Message}
 */
export function allHeadline(goalText, growth, targetYear) {
  switch (goalText) {
    case "Tripled": return message("ok", "Renewables have tripled",
      `The world has already met its goal of tripling clean power by ${targetYear}.`);
    case "On track": return message("ok", "On track to triple clean power",
      `Solar, wind and other clean power are growing fast enough to triple by ${targetYear}.`);
    case "Close": return message("warn", "Almost on track",
      `Clean power is growing fast, but not quite fast enough to triple by ${targetYear}.`);
    case "Off track": return message("warn", "Growing, but too slowly",
      `Clean power is growing, but far too slowly to triple by ${targetYear}.`);
    case "Going backwards": return message("bad", "Clean power is shrinking",
      `The world is moving away from its goal of tripling clean power by ${targetYear}.`);
    default: return sourceHeadline("Clean", growth);
  }
}

/**
 * The answer for a single source (solar, wind, hydro), from its world yearly growth as displayed.
 * @param {string} name     "Solar", "Wind", "Hydro" or "Clean" (the title adds " power")
 * @param {number} growth   yearly change (0.3 = +30%)
 * @returns {Message}
 */
export function sourceHeadline(name, growth) {
  const g = shown(growth * 100, 1), s = Math.sign(g);
  const by = `${fmt[1].format(Math.abs(g))}% in the latest year`;
  if (g >= 10) return message("ok", `${name} power is booming`, `It grew ${by}. Every unit of it means less coal and gas burned.`);
  if (s > 0) return message("ok", `${name} power is growing`, `It grew ${by}, replacing some coal and gas.`);
  if (s === 0) return message("warn", `${name} power isn't growing`, "It stayed about the same in the latest year.");
  return message("bad", `${name} power is falling`, `It fell ${by}. Dry years can cut hydropower, for example.`);
}

/**
 * Traffic light: the tripling goal (installed capacity).
 * @param {string} goalText   verdict text from capacityModel
 * @param {number} pctOfGoal  installed now as % of the goal (53.3)
 * @param {number} growth     latest yearly growth of capacity (0.155)
 * @param {number} needed     growth needed per year to triple on time (0.164)
 * @returns {Message}
 */
export function goalStatus(goalText, pctOfGoal, growth, needed) {
  const text = `${fmt[0].format(pctOfGoal)}% of the way there. Growing ${pct(growth * 100)} a year; needs ${pct(needed * 100)}.`;
  switch (goalText) {
    case "Tripled": return message("ok", "Goal reached", `${fmt[0].format(pctOfGoal)}% of the goal installed.`);
    case "On track": return message("ok", "On track", text);
    case "Close": return message("warn", "Almost there", text);
    case "Off track": return message("warn", "Too slow", text);
    default: return message("bad", "Going backwards", text);
  }
}

/**
 * Traffic light: share of the world's electricity, compared with the first year shown.
 * @param {number} share       % now (33.8)
 * @param {number} shareFirst  % in the first year (23.0)
 * @param {number} firstYear
 * @returns {Message}
 */
export function shareStatus(share, shareFirst, firstYear) {
  const now = shown(share, 1), then = shown(shareFirst, 1);
  const title = `${fmt[0].format(now)}% of the world's electricity`;
  if (now > then) return message("ok", title, `Up from ${pct(then)} in ${firstYear}, a growing part of the world's power.`);
  if (now < then) return message("bad", title, `Down from ${pct(then)} in ${firstYear}, a shrinking part of the world's power.`);
  return message("warn", title, `The same as in ${firstYear}.`);
}

/**
 * A country's direction, for the badge on its card: growing clean power is good, shrinking is bad.
 * @param {number | null} growth  yearly change, or null when unknown
 * @returns {{ tone: Tone | "", label: string }}
 */
export function trendBadge(growth) {
  if (growth == null) return { tone: "", label: "" };
  const s = shownSign(growth * 100, 1);
  return s > 0 ? { tone: "ok", label: "▲ Growing" } : s < 0 ? { tone: "bad", label: "▼ Shrinking" } : { tone: "warn", label: "● Steady" };
}
