// @ts-check
/**
 * Renewables Clock: the plain-language messages shown to visitors. Pure functions, unit tested.
 * Each returns a clock-core Message (tone, icon, short title, one sentence). Keep them short and free of jargon;
 * numbers and method details belong behind "More". The words are in js/i18n/ (English in en.js).
 */
import { shown, shownSign, pct, message, t, locale, addStrings } from "clock-core";
import en from "./i18n/en.js";

addStrings("en", en);   // the English words; app.js adds the visitor's language on top

/** @typedef {import("clock-core").Message} Message */
/** @typedef {import("clock-core").Tone} Tone */
/** @typedef {import("./model.js").GoalKey} GoalKey  "tripled", "onTrack", "close", "offTrack" or "backwards" */
/** @typedef {"clean" | "all" | "solar" | "wind" | "hydro"} PowerKey */

/**
 * Text with its first letter capitalised, for a message that starts with a source's name ("{power} is booming":
 * "Solar power is booming", "L’énergie solaire est en plein essor"). Arabic has no capitals and is left as it is.
 * @param {string} s
 */
export const upFirst = (s) => s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);

/** @param {GoalKey | ""} key @returns {Exclude<GoalKey, "">} */
const goalKey = (key) => (key === "tripled" || key === "onTrack" || key === "close" || key === "offTrack" ? key : "backwards");

/**
 * The one-line answer at the top of the "All renewables" view, from the tripling-goal verdict.
 * Until capacity data arrives, falls back to whether clean power is growing.
 * @param {GoalKey | null} goal  verdict key from capacityModel, or null if unknown
 * @param {number} growth        world renewable generation, yearly change (0.086 = +8.6%)
 * @param {number} targetYear
 * @returns {Message}
 */
export function allHeadline(goal, growth, targetYear) {
  if (goal == null) return sourceHeadline("clean", growth);
  const k = goalKey(goal);
  const tone = k === "tripled" || k === "onTrack" ? "ok" : k === "backwards" ? "bad" : "warn";
  return message(tone, t(`msg.all.${k}.t`), t(`msg.all.${k}.x`, { year: targetYear }));
}

/**
 * The answer for a single source (solar, wind, hydro), from its world yearly growth as displayed.
 * @param {PowerKey} key   which source ("clean" for all renewables in a sentence about growth)
 * @param {number} growth  yearly change (0.3 = +30%)
 * @returns {Message}
 */
export function sourceHeadline(key, growth) {
  const g = shown(growth * 100, 1), s = Math.sign(g);
  const [tone, k] = g >= 10 ? ["ok", "boom"] : s > 0 ? ["ok", "up"] : s === 0 ? ["warn", "flat"] : ["bad", "down"];
  return message(/** @type {Tone} */ (tone), upFirst(t(`msg.src.${k}.t`, { power: t(`msg.power.${key}`) })), t(`msg.src.${k}.x`, { pct: pct(Math.abs(g), 1) }));
}

/**
 * Traffic light: the tripling goal (installed capacity).
 * @param {GoalKey} goal      verdict key from capacityModel
 * @param {number} pctOfGoal  installed now as % of the goal (53.3)
 * @param {number} growth     latest yearly growth of capacity (0.155)
 * @param {number} needed     growth needed per year to triple on time (0.164)
 * @returns {Message}
 */
export function goalStatus(goal, pctOfGoal, growth, needed) {
  const k = goalKey(goal);
  if (k === "tripled") return message("ok", t("msg.goal.tripled"), t("msg.goal.done", { pct: pct(pctOfGoal, 0) }));
  const text = t("msg.goal.text", { pct: pct(pctOfGoal, 0), growth: pct(growth * 100), needed: pct(needed * 100) });
  const tone = k === "onTrack" ? "ok" : k === "backwards" ? "bad" : "warn";
  return message(tone, t(`msg.goal.${k}`), text);
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
  const title = t("msg.share.t", { pct: pct(now, 0) });
  if (now > then) return message("ok", title, t("msg.share.up", { pct: pct(then), year: firstYear }));
  if (now < then) return message("bad", title, t("msg.share.down", { pct: pct(then), year: firstYear }));
  return message("warn", title, t("msg.share.same", { year: firstYear }));
}

/**
 * A country's direction, for the badge on its card: growing clean power is good, shrinking is bad.
 * @param {number | null} growth  yearly change, or null when unknown
 * @returns {{ tone: Tone | "", label: string }}
 */
export function trendBadge(growth) {
  if (growth == null) return { tone: "", label: "" };
  const s = shownSign(growth * 100, 1);
  return s > 0 ? { tone: "ok", label: t("msg.badge.up") } : s < 0 ? { tone: "bad", label: t("msg.badge.down") } : { tone: "warn", label: t("msg.badge.flat") };
}
