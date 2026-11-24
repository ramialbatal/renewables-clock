// Unit tests for the Renewables Clock model. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "clock-core";
import { indexGeneration, indexCapacity, seriesFor, generationEntry, capacityModel, restOfWorld } from "../js/model.js";
import CFG from "../js/config.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);
const header = "entity,code,year," + Object.values(CFG.columns).join(",");
const row = (entity, code, year, vals) => `${entity},${code},${year},` + Object.keys(CFG.columns).map((k) => vals[k] ?? "").join(",");

test("indexGeneration keeps wanted codes and years, treats blanks as 0, skips empty years", () => {
  const csv = [header,
    row("World", "OWID_WRL", 2014, { solar: 1 }),                       // before historyFrom
    row("World", "OWID_WRL", 2024, { solar: 10, wind: 20, coal: 70 }),
    row("Saudi Arabia", "SAU", 2024, { solar: 8, gas: 288 }),           // hydro blank: must not drop the row
    row("Saudi Arabia", "SAU", 2025, {}),                               // not reported yet: skipped
    row("Atlantis", "ATL", 2024, { solar: 1 })                          // not wanted
  ].join("\n");
  const d = indexGeneration(parseCsv(csv), ["OWID_WRL", "SAU"], CFG);
  assert.deepEqual(Object.keys(d).sort(), ["OWID_WRL", "SAU"]);
  assert.deepEqual(Object.keys(d.OWID_WRL.years), ["2024"]);
  assert.equal(d.OWID_WRL.years[2024].total, 100);
  assert.equal(d.SAU.years[2024].hydro, 0);
  assert.equal(d.SAU.years[2025], undefined);
});

test("seriesFor and generationEntry: totals, share of electricity, capped projection", () => {
  const entity = { name: "X", years: {
    2024: { ...zeros(), solar: 10, wind: 10, coal: 80, total: 100 },
    2025: { ...zeros(), solar: 30, wind: 10, coal: 60, total: 100 }
  } };
  assert.deepEqual(seriesFor(entity, ["solar", "wind"]), { 2024: 20, 2025: 40 });
  const e = generationEntry(entity, ["solar"], { trendYears: 1, maxGrowth: 0.5 }, 2026);
  close(e.growth, 2);                 // solar tripled
  close(e.annual, 30 * 1.5);          // but the projection is capped at +50%
  close(e.share, 30);
  close(e.shareSeries[2024], 10);
});

test("capacityModel: world goal, on-track path, verdicts", () => {
  const world = { 2022: 3379, 2024: 4462, 2025: 5155 };
  const m = capacityModel(world, { base: 2022, targetYear: 2030 }, 11000);
  close(m.p.growth, 5155 / 4462 - 1);
  close(m.needed, Math.pow(11000 / 5155, 1 / 5) - 1);       // from end of 2025 to end of 2030
  assert.equal(m.verdict.text, "Close");
  close(m.path(2023), 3379);                                 // end of 2022
  close(m.path(2031), 11000);                                // end of 2030
  close(m.now(2026), 5155);                                  // end of 2025
  close(m.multiple, 5155 / 3379);
});

test("capacityModel: own tripling for countries, and the Tripled verdict", () => {
  const sau = capacityModel({ 2022: 0.84, 2024: 6.6, 2025: 12.3 }, { base: 2022, targetYear: 2030 });
  assert.equal(sau.goal, 0.84 * 3);
  assert.equal(sau.verdict.text, "Tripled");
  const slow = capacityModel({ 2022: 100, 2024: 105, 2025: 106 }, { base: 2022, targetYear: 2030 });
  assert.equal(slow.verdict.text, "Off track");
});

test("indexCapacity maps entity ids to codes", () => {
  const data = { values: [3379, 5155, 1], years: [2022, 2025, 2025], entities: [1, 1, 2] };
  const meta = { dimensions: { entities: { values: [{ id: 1, code: "OWID_WRL" }, { id: 2, code: "ATL" }] } } };
  assert.deepEqual(indexCapacity(data, meta, ["OWID_WRL"]), { OWID_WRL: { 2022: 3379, 2025: 5155 } });
});

test("restOfWorld ignores entries that are part of another (Germany in the EU)", () => {
  const r = restOfWorld({ annual: 100, lastValue: 90, lastYear: 2025 }, [
    { annual: 30, series: { 2025: 25 } }, { annual: 20, series: { 2025: 15 }, partOf: "EU" }
  ]);
  assert.deepEqual(r, { annual: 70, lastValue: 65, lastYear: 2025 });
});

function zeros() {
  return Object.fromEntries(Object.keys(CFG.columns).map((k) => [k, 0]));
}
