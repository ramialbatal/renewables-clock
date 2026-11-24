// Unit tests for the plain-language messages. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { allHeadline, sourceHeadline, goalStatus, shareStatus, trendBadge } from "../js/messages.js";

test("allHeadline: one clear answer per tripling verdict, with a fallback before capacity data arrives", () => {
  assert.deepEqual([allHeadline("Close", 0.086, 2030).tone, allHeadline("Close", 0.086, 2030).title], ["warn", "Almost on track"]);
  assert.equal(allHeadline("On track", 0.1, 2030).tone, "ok");
  assert.equal(allHeadline("Off track", 0.1, 2030).title, "Growing, but too slowly");
  assert.equal(allHeadline("Going backwards", -0.01, 2030).tone, "bad");
  assert.equal(allHeadline("Tripled", 0.1, 2030).title, "Renewables have tripled");
  assert.equal(allHeadline(null, 0.086, 2030).title, "Clean power is growing");
});

test("sourceHeadline: booming, growing, flat or falling, as displayed", () => {
  assert.equal(sourceHeadline("Solar", 0.297).title, "Solar power is booming");
  assert.equal(sourceHeadline("Solar", 0.297).text, "It grew 29.7% in the latest year. Every unit of it means less coal and gas burned.");
  assert.equal(sourceHeadline("Wind", 0.05).title, "Wind power is growing");
  assert.equal(sourceHeadline("Hydro", 0.0003).tone, "warn");          // +0.03% shows as 0.0%
  assert.equal(sourceHeadline("Hydro", -0.02).tone, "bad");
});

test("goalStatus explains how far along and how fast", () => {
  const m = goalStatus("Close", 53.3, 0.155, 0.164);
  assert.equal(m.tone, "warn");
  assert.equal(m.title, "Almost there");
  assert.equal(m.text, "53% of the way there. Growing 15.5% a year; needs 16.4%.");
  assert.equal(goalStatus("Tripled", 101, 0.1, 0).title, "Goal reached");
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
