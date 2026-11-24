// @ts-check
/**
 * Renewables Clock: pure data and model functions (no DOM, no network). Unit tested in test/model.test.js.
 */
import { project, neededGrowth, verdict, shown, num, t, YEAR } from "clock-core";

/** @typedef {import("./config.js").Config} Config */
/** @typedef {import("./config.js").Column} Column */
/** @typedef {Record<Column, number> & { total: number }} YearMix  TWh by source for one year, plus the total. */
/** @typedef {{ name: string, years: Record<number, YearMix> }} Entity */
/** @typedef {Record<number, number>} Series */
/** @typedef {import("clock-core").Verdict["key"] | "tripled"} GoalKey  a verdict key, or "tripled" once the goal is met */
/** @typedef {{ cls: import("clock-core").Verdict["cls"], key: GoalKey, text: string }} GoalVerdict */

/**
 * Index generation rows (OWID "full" CSV) into { code: { name, years: { year: mix } } }.
 * Keeps only `wanted` codes and years from cfg.historyFrom. A few blank cells count as 0 (Saudi Arabia has no
 * hydro figure), but a row with fewer than half its cells filled, or a total of 0, is a year not yet reported
 * (OWID pre-fills future rows with a few zeros) and is skipped.
 * @param {Record<string, string>[]} rows
 * @param {Iterable<string>} wanted
 * @param {Pick<Config, "columns" | "historyFrom">} cfg
 * @returns {Record<string, Entity>}
 */
export function indexGeneration(rows, wanted, cfg) {
  const keep = new Set(wanted);
  const keys = /** @type {Column[]} */ (Object.keys(cfg.columns));
  /** @type {Record<string, Entity>} */
  const out = {};
  for (const r of rows) {
    if (!keep.has(r.code) || Number(r.year) < cfg.historyFrom) continue;
    const v = /** @type {YearMix} */ ({ total: 0 });
    let filled = 0;
    for (const k of keys) {
      const x = num(r[cfg.columns[k]]);
      v[k] = Number.isFinite(x) ? x : 0;
      if (Number.isFinite(x)) filled++;
      v.total += v[k];
    }
    if (filled < keys.length / 2 || v.total <= 0) continue;
    (out[r.code] ||= { name: r.entity, years: {} }).years[Number(r.year)] = v;
  }
  return out;
}

/**
 * Index IRENA capacity (OWID indicator API: data.json + metadata.json) into { code: { year: GW } }.
 * @param {{ values: number[], years: number[], entities: number[] }} data
 * @param {{ dimensions: { entities: { values: { id: number, code?: string }[] } } }} meta
 * @param {Iterable<string>} wanted
 * @returns {Record<string, Series>}
 */
export function indexCapacity(data, meta, wanted) {
  const keep = new Set(wanted);
  /** @type {Record<number, string | undefined>} */
  const codeOf = {};
  for (const e of meta.dimensions.entities.values) codeOf[e.id] = e.code;
  /** @type {Record<string, Series>} */
  const out = {};
  data.values.forEach((v, i) => {
    const code = codeOf[data.entities[i]];
    if (code && keep.has(code) && Number.isFinite(v)) (out[code] ||= {})[data.years[i]] = v;
  });
  return out;
}

/**
 * Sum the given columns into a { year: TWh } series.
 * @param {Entity} entity
 * @param {Column[]} parts
 * @returns {Series}
 */
export function seriesFor(entity, parts) {
  /** @type {Series} */
  const s = {};
  for (const [y, v] of Object.entries(entity.years)) s[Number(y)] = parts.reduce((a, p) => a + v[p], 0);
  return s;
}

/**
 * Generation model for one place and source: projection to this year plus share of its electricity.
 * @param {Entity} entity
 * @param {Column[]} parts
 * @param {Pick<Config, "trendYears" | "maxGrowth">} cfg
 * @param {number} [year]
 */
export function generationEntry(entity, parts, cfg, year = YEAR) {
  const series = seriesFor(entity, parts);
  const p = project(series, cfg.trendYears, cfg.maxGrowth, year);
  /** @type {Series} */
  const shareSeries = {};
  for (const y of p.years) shareSeries[y] = (series[y] / entity.years[y].total) * 100;
  return { ...p, shareSeries, share: shareSeries[p.lastYear] };
}

/**
 * Capacity goal model. IRENA values are end-of-year, so value(y) sits at fractional year y + 1.
 * Capacity now grows from the latest value at its latest yearly growth. The on-track path compounds
 * evenly from the base year's value to the goal at the end of the target year.
 * @param {Series} series        Installed capacity in GW by year (end of year).
 * @param {Pick<import("./config.js").CapacityGoal, "base" | "targetYear">} goal
 * @param {number} [target]      Goal in GW; defaults to 3× the base year (a country tripling its own capacity).
 */
export function capacityModel(series, goal, target) {
  const p = project(series, 1);
  const baseVal = series[goal.base];
  const goalGw = target ?? baseVal * 3;
  const tBase = goal.base + 1, tGoal = goal.targetYear + 1, tLast = p.lastYear + 1;
  const needed = neededGrowth(p.lastValue, goalGw, tGoal - tLast);
  const multiple = p.lastValue / baseVal;
  const done = shown(p.lastValue / goalGw * 3, 1) >= 3;   // "Tripled" when the multiple of the goal, as displayed, reaches 3.0
  return {
    p, baseVal, goal: goalGw, needed,
    multiple,
    // compared as displayed (growth and needed are shown as percentages with 1 decimal)
    /** @type {GoalVerdict} */
    verdict: done ? { cls: "ok", key: "tripled", text: t("goal.tripled") } : verdict(shown(p.growth * 100, 1), shown(needed * 100, 1)),
    /** @param {number} t fractional year */
    now: (t) => p.lastValue * Math.pow(1 + p.growth, t - tLast),
    /** @param {number} t fractional year */
    path: (t) => baseVal * Math.pow(goalGw / baseVal, (t - tBase) / (tGoal - tBase))
  };
}
