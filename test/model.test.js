// Unit tests for the Renewables Clock model. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "clock-core";
import { indexGeneration, indexCapacity, seriesFor, generationEntry, capacityModel } from "../js/model.js";
import CFG from "../js/config.js";
import "../js/messages.js";   // registers the English words (the "Tripled" verdict text)

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);
const header = "entity,code,year," + Object.values(CFG.columns).join(",");
const row = (entity, code, year, vals) => `${entity},${code},${year},` + Object.keys(CFG.columns).map((k) => vals[k] ?? "").join(",");

const full = { solar: 1, wind: 1, hydro: 1, bio: 1, otherRen: 0, nuclear: 0, gas: 1, oil: 0, coal: 1 };

test("indexGeneration keeps wanted codes and years, treats a few blanks as 0, skips unreported years", () => {
  const csv = [header,
    row("World", "OWID_WRL", 2014, full),                                         // before historyFrom
    row("World", "OWID_WRL", 2024, { ...full, solar: 10, wind: 20, coal: 67 }),   // total 100
    row("Saudi Arabia", "SAU", 2024, { ...full, hydro: "", solar: 8, gas: 288 }), // one blank (no hydro): kept as 0
    row("Saudi Arabia", "SAU", 2025, {}),                                         // not reported yet: skipped
    row("Indonesia", "IDN", 2025, { bio: 0, nuclear: 0 }),                        // pre-filled with a few zeros: skipped
    row("Atlantis", "ATL", 2024, full)                                            // not wanted
  ].join("\n");
  const d = indexGeneration(parseCsv(csv), ["OWID_WRL", "SAU", "IDN"], CFG);
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
  assert.equal(m.verdict.key, "close");
  close(m.path(2023), 3379);                                 // end of 2022
  close(m.path(2031), 11000);                                // end of 2030
  close(m.now(2026), 5155);                                  // end of 2025
  close(m.multiple, 5155 / 3379);
});

test("capacityModel: own tripling for countries, and the Tripled verdict", () => {
  const sau = capacityModel({ 2022: 0.84, 2024: 6.6, 2025: 12.3 }, { base: 2022, targetYear: 2030 });
  assert.equal(sau.goal, 0.84 * 3);
  assert.equal(sau.verdict.key, "tripled");
  assert.equal(sau.verdict.text, "Tripled");
  const slow = capacityModel({ 2022: 100, 2024: 105, 2025: 106 }, { base: 2022, targetYear: 2030 });
  assert.equal(slow.verdict.key, "offTrack");
});

test("indexCapacity maps entity ids to codes", () => {
  const data = { values: [3379, 5155, 1], years: [2022, 2025, 2025], entities: [1, 1, 2] };
  const meta = { dimensions: { entities: { values: [{ id: 1, code: "OWID_WRL" }, { id: 2, code: "ATL" }] } } };
  assert.deepEqual(indexCapacity(data, meta, ["OWID_WRL"]), { OWID_WRL: { 2022: 3379, 2025: 5155 } });
});

test("capacityModel: Tripled is judged on the multiple as displayed", () => {
  const goal = { base: 2022, targetYear: 2030 };
  assert.equal(capacityModel({ 2022: 100, 2024: 290, 2025: 296 }, goal).verdict.key, "tripled");   // x2.96 shows as x3.0
  assert.notEqual(capacityModel({ 2022: 100, 2024: 290, 2025: 294 }, goal).verdict.key, "tripled"); // x2.94 shows as x2.9
});

test("capacityModel verdict compares growth as displayed", () => {
  // 15.5% growth against about 16.4% needed is within 85% of it: "Close"
  const goal = { base: 2022, targetYear: 2030 };
  const m = capacityModel({ 2022: 1000, 2024: 1000, 2025: 1155 }, goal, 2484);   // needs ~16.5%, has 15.5%
  assert.equal(m.verdict.key, "close");
});

function zeros() {
  return Object.fromEntries(Object.keys(CFG.columns).map((k) => [k, 0]));
}
