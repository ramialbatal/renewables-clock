// Unit tests for the plain-language messages. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { addStrings, setLang } from "clock-core";
import { allHeadline, sourceHeadline, goalStatus, shareStatus, trendBadge } from "../js/messages.js";
import fr from "../js/i18n/fr.js";

test("allHeadline: one clear answer per tripling verdict, with a fallback before capacity data arrives", () => {
  assert.deepEqual([allHeadline("close", 0.086, 2030).tone, allHeadline("close", 0.086, 2030).title], ["warn", "Almost on track"]);
  assert.equal(allHeadline("onTrack", 0.1, 2030).tone, "ok");
  assert.equal(allHeadline("offTrack", 0.1, 2030).title, "Growing, but too slowly");
  assert.equal(allHeadline("backwards", -0.01, 2030).tone, "bad");
  assert.equal(allHeadline("tripled", 0.1, 2030).title, "Renewables have tripled");
  assert.equal(allHeadline(null, 0.086, 2030).title, "Clean power is growing");
});

test("sourceHeadline: booming, growing, flat or falling, as displayed", () => {
  assert.equal(sourceHeadline("solar", 0.297).title, "Solar power is booming");
  assert.equal(sourceHeadline("solar", 0.297).text, "It grew 29.7% in the latest year. Every unit of it means less coal and gas burned.");
  assert.equal(sourceHeadline("wind", 0.05).title, "Wind power is growing");
  assert.equal(sourceHeadline("hydro", 0.0003).tone, "warn");          // +0.03% shows as 0.0%
  assert.equal(sourceHeadline("hydro", -0.02).tone, "bad");
  assert.equal(sourceHeadline("hydro", -0.02).title, "Hydro power is falling");
});

test("goalStatus explains how far along and how fast", () => {
  const m = goalStatus("close", 53.3, 0.155, 0.164);
  assert.equal(m.tone, "warn");
  assert.equal(m.title, "Almost there");
  assert.equal(m.text, "53% of the way there. Growing 15.5% a year; needs 16.4%.");
  assert.equal(goalStatus("tripled", 101, 0.1, 0).title, "Goal reached");
  assert.equal(goalStatus("backwards", 40, -0.01, 0.2).tone, "bad");
});

test("shareStatus compares the share as displayed with the first year", () => {
  assert.deepEqual([shareStatus(33.8, 23, 2015).tone, shareStatus(33.8, 23, 2015).title], ["ok", "34% of the world's electricity"]);
  assert.equal(shareStatus(14.0, 16.2, 2015).tone, "bad");
  assert.equal(shareStatus(14.04, 13.96, 2015).tone, "warn");             // both show as 14.0%
});

test("trendBadge: growing is good, shrinking is bad", () => {
  assert.deepEqual(trendBadge(0.1), { tone: "ok", label: "▲ Growing" });
  assert.deepEqual(trendBadge(-0.1), { tone: "bad", label: "▼ Shrinking" });
  assert.deepEqual(trendBadge(null), { tone: "", label: "" });
});

test("messages in another language: the source's name starts the sentence with a capital, numbers in local format", () => {
  addStrings("fr", fr);
  setLang("fr");
  try {
    assert.equal(sourceHeadline("solar", 0.297).title, "L’énergie solaire est en plein essor");
    assert.equal(sourceHeadline("wind", 0.05).text, "Elle a progressé de 5,0\u202f% sur la dernière année connue et remplace une partie du charbon et du gaz.");
    assert.equal(allHeadline("close", 0.1, 2030).tone, "warn");   // verdicts are keys, so they work in every language
  } finally { setLang("en"); }
});
