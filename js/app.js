// @ts-check
/**
 * Renewables Clock: loads the data, renders the page and runs the live counters.
 * Calculations live in model.js (pure, tested); settings in config.js.
 */
import * as C from "clock-core";
import CFG from "./config.js";
import { indexGeneration, indexCapacity, generationEntry, capacityModel } from "./model.js";
import { allHeadline, sourceHeadline, goalStatus, shareStatus, trendBadge } from "./messages.js";

const { YEAR, fmt, pct, setText, escapeHtml } = C;
const MWH_PER_TWH = 1e6;
/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** @typedef {keyof typeof CFG.sources} SourceKey */

const codes = [CFG.world, ...CFG.countries.map((c) => c.code)];

// ---- Data ------------------------------------------------------------------------
// Generation: the "full" CSV (about 150 KB compressed), because OWID's "filtered" CSV
// drops years with any blank cell and loses countries such as Saudi Arabia.
const loadGeneration = C.once(async () => {
  const q = new URLSearchParams({ ...CFG.chartParams, v: "1", csvType: "full", useColumnShortNames: "true" });
  const data = indexGeneration(await C.fetchCsv(`${CFG.apiBase}${CFG.chart}.csv?${q}`), codes, CFG);
  if (!data[CFG.world]) throw new Error("World total missing from response");
  const missing = CFG.countries.filter((c) => !data[c.code]).map((c) => c.code);
  if (missing.length) console.warn("No generation data for:", missing.join(", "));
  return { data, fetchedAt: new Date() };
});

// Capacity (for the COP28 goal) is optional: if it fails, the goal section stays hidden.
const loadCapacity = C.once(async () => {
  const base = `${CFG.capacity.apiBase}${CFG.capacity.indicator}`;
  const [d, meta] = await Promise.all([C.fetchJson(`${base}.data.json`), C.fetchJson(`${base}.metadata.json`)]);
  const cap = indexCapacity(d, meta, codes);
  if (!cap[CFG.world]) throw new Error("World capacity missing");
  return cap;
});

// ---- Rendering helpers ---------------------------------------------------------------
/** @param {number} annualTwh */
const perSecond = (annualTwh) => (annualTwh * MWH_PER_TWH) / C.SEC_PER_YEAR;

/** @param {number} twh */
function energy(twh) {
  if (Math.abs(twh) >= 100) return fmt[0].format(twh) + " TWh";
  if (Math.abs(twh) >= 1) return fmt[1].format(twh) + " TWh";
  return fmt[0].format(twh * 1000) + " GWh";
}

/** @param {ReturnType<typeof generationEntry>} e @param {string} name */
function sparkFor(e, name) {
  const vals = e.years.map((y) => e.series[y]);
  if (vals.every((v) => v === 0)) return "";            // e.g. hydro in Saudi Arabia: nothing to chart
  const first = e.years[0], last = e.years[e.years.length - 1];
  const change = vals[0] > 0 ? (vals[vals.length - 1] / vals[0] - 1) * 100 : null;
  const changeText = change == null ? "new" : C.signed(change) + "%";
  return C.sparkline(e.years, vals, {
    caption: `${first}-${String(last).slice(2)}`, change, changeText, good: "up",
    label: `${name}: annual generation ${first} to ${last}, ${changeText}`
  });
}

/** For renewables, up is good. @param {number} x @param {number} d decimals shown */
const goodBadClass = (x, d) => C.changeClass(x, d, "up");

/** Decimals for a live MWh counter so its last digit moves about once a second or faster. @param {number} mwhPerSec */
const counterDecimals = (mwhPerSec) => (mwhPerSec >= 1 ? 0 : mwhPerSec >= 0.1 ? 1 : mwhPerSec >= 0.01 ? 2 : 3);

/** @param {ReturnType<typeof generationEntry>} e */
function historyTable(e) {
  const rows = e.years.slice().reverse().map((y) => {
    const prev = e.series[y - 1];
    const ch = prev ? (e.series[y] / prev - 1) * 100 : null;
    return `<tr><th>${y}</th><td>${energy(e.series[y])}</td><td>${pct(e.shareSeries[y])}</td><td class="${
      ch == null ? "" : goodBadClass(ch, 1)}">${ch == null ? "" : C.signed(ch, fmt[1]) + "%"}</td></tr>`;
  }).join("");
  return `<div class="history" hidden><table><caption>Official annual generation, share of electricity, change</caption>${rows}</table></div>`;
}

/** @param {ReturnType<typeof capacityModel>} m */
function cardGoalHtml(m) {
  const { base, targetYear } = CFG.capacity;
  return `<div class="card-goal">
      <div class="goal-bar" title="Installed renewable capacity toward 3× its ${base} level by ${targetYear}">
        <i style="width:${Math.min(m.multiple / 3, 1) * 100}%"></i><span class="cg-mark"></span></div>
      <p><span>Capacity ×${fmt[1].format(m.multiple)} vs ${base} · goal ×3 by ${targetYear}</span>
        <span class="verdict ${m.verdict.cls}" title="Growth ${pct(m.p.growth * 100)} a year${
          m.verdict.text === "Tripled" ? "" : `, needs ${pct(m.needed * 100)}`}">${m.verdict.text}</span></p>
    </div>`;
}

// ---- World goal section ----------------------------------------------------------------
/** @param {Record<string, Record<number, number>>} cap */
function renderGoal(cap) {
  const K = CFG.capacity;
  if (!cap[CFG.world]?.[K.base]) throw new Error(`World capacity for ${K.base} missing`);
  const m = capacityModel(cap[CFG.world], K, K.target);
  C.fill("cap-base-year", K.base);
  C.fill("cap-target-year", K.targetYear);
  C.fill("cap-last-year", m.p.lastYear);
  $("cap-target").textContent = fmt[0].format(K.target);
  $("cap-base").textContent = fmt[0].format(m.baseVal);
  $("cap-last").textContent = fmt[0].format(m.p.lastValue);
  $("cap-growth").textContent = pct(m.p.growth * 100);
  $("cap-needed").textContent = pct(m.needed * 100);
  C.showVerdict($("cap-verdict"), m.verdict);
  $("goal").hidden = false;
  worldCap = m;
  /** @param {number} t */
  return (t) => {
    const now = m.now(t);
    setText($("cap-now"), fmt[0].format(now * 1e6));    // kW: capacity grows about 25 kW a second, so MW would barely move
    setText($("cap-pct"), pct((now / K.target) * 100, 2));
    $("cap-bar").style.width = Math.min(now / K.target, 1) * 100 + "%";
    $("cap-mark").style.left = Math.min(m.path(t) / K.target, 1) * 100 + "%";
    setText($("cap-path"), fmt[0].format(m.path(t)));
  };
}

// ---- Page ------------------------------------------------------------------------------
const T0 = Date.now();                 // page-open time, shared by all sources
/** @type {((t: number) => void) | null} */
let goalTick = null;                   // set once capacity data arrives
/** @type {ReturnType<typeof capacityModel> | null} */
let worldCap = null;                   // world tripling-goal model, once capacity data arrives

/**
 * The answer at the top and the traffic-light cards, for the current view.
 * @param {SourceKey} srcKey @param {ReturnType<typeof generationEntry>} world
 */
function renderStanding(srcKey, world) {
  const K = CFG.capacity, src = CFG.sources[srcKey];
  C.showAnswer(srcKey === "all"
    ? allHeadline(worldCap?.verdict.text ?? null, world.growth, K.targetYear)
    : sourceHeadline(src.label, world.growth));
  const cards = [];
  if (worldCap) {
    const pctOfGoal = (worldCap.now(C.tYears()) / K.target) * 100;
    cards.push(C.statusCard({ label: `Goal: triple clean power by ${K.targetYear}`, pct: pctOfGoal,
      barLabel: `${fmt[0].format(pctOfGoal)}% of the goal`,
      msg: goalStatus(worldCap.verdict.text, pctOfGoal, worldCap.p.growth, worldCap.needed) }));
  }
  cards.push(C.statusCard({ label: `${src.label} power's share`, pct: world.share,
    msg: shareStatus(world.share, world.shareSeries[world.years[0]], world.years[0]) }));
  cards.push(C.statusCard({ label: "Growing this year?", msg: sourceHeadline(srcKey === "all" ? "Clean" : src.label, world.growth) }));
  $("status-cards").innerHTML = cards.join("");
}

/**
 * @param {Record<string, import("./model.js").Entity>} data
 * @param {Record<string, Record<number, number>> | null} cap
 * @param {SourceKey} srcKey
 */
function render(data, cap, srcKey) {
  const src = CFG.sources[srcKey];
  const world = generationEntry(data[CFG.world], src.parts, CFG);
  const wRate = perSecond(world.annual);

  const entries = CFG.countries.filter((c) => data[c.code]).map((c) => {
    const e = generationEntry(data[c.code], src.parts, CFG);
    const cm = srcKey === "all" && cap?.[c.code]?.[CFG.capacity.base] ? capacityModel(cap[c.code], CFG.capacity) : null;
    return { ...c, ...e, name: c.name || data[c.code].name, cm, rest: false };
  });
  const row = C.restOfWorld(world, entries);

  // Header and method fill-ins
  C.fill("latest", world.lastYear);
  C.fill("first", world.years[0]);
  C.fill("trend-from", world.trendFrom);
  $("world-rate").textContent = fmt[0].format(wRate);
  $("world-annual").textContent = fmt[0].format(world.annual);
  $("world-official").textContent = fmt[0].format(world.lastValue);
  const gSign = C.shownSign(world.growth * 100, 1);
  $("world-growth-word").textContent = gSign > 0 ? "growing" : gSign < 0 ? "falling" : "flat";
  $("world-growth").textContent = gSign ? pct(Math.abs(world.growth * 100)) : "";
  const shareFirst = world.shareSeries[world.years[0]];
  const sSign = Math.sign(C.shown(world.share, 1) - C.shown(shareFirst, 1));
  $("world-share-word").textContent = sSign > 0 ? "up from" : sSign < 0 ? "down from" : "the same as";
  $("world-share").textContent = pct(world.share);
  $("world-share-first").textContent = pct(shareFirst);
  renderMix(data[CFG.world].years[world.lastYear]);
  renderStanding(srcKey, world);

  const grid = $("grid");
  grid.innerHTML = "";
  const all = [...entries, { code: "ROW", flag: "🌐", name: "Rest of world", rest: true, partOf: undefined, ...row,
    growth: null, share: null, years: null, cm: null }];
  const cards = all.map((e) => {
    const shareOfWorld = (e.annual / world.annual) * 100;
    const g = e.growth;
    const el = document.createElement("article");
    el.className = "card" + (e.rest ? " rest" : "");
    const badge = trendBadge(g);
    el.innerHTML = `
      <header>
        <span class="flag" aria-hidden="true">${e.flag}</span>
        <h3>${escapeHtml(e.name)}</h3>
        ${e.partOf ? `<span class="tag">part of ${escapeHtml(e.partOf)}</span>` : ""}
        ${C.badge(badge.tone, badge.label)}
      </header>
      <div class="ytd"><span class="num">0</span> <small>MWh in ${YEAR}</small></div>
      <div class="bar" title="${e.share != null ? fmt[1].format(e.share) + "% of its electricity" : ""}"><i style="width:${Math.min(e.share ?? 0, 100)}%"></i></div>
      <p class="share">${e.share != null ? `${fmt[0].format(e.share)}% of its electricity is ${escapeHtml(src.label.toLowerCase())}` : `${fmt[0].format(shareOfWorld)}% of the world's ${escapeHtml(src.label.toLowerCase())} power`}</p>
      <details class="more-info">
        <summary>More</summary>
        ${"shareSeries" in e && e.years ? sparkFor(/** @type {any} */ (e), e.name) : ""}
        <dl>
          <div><dt>Share of world ${escapeHtml(src.label.toLowerCase())}</dt><dd>${pct(shareOfWorld)}</dd></div>
          <div><dt>Per second</dt><dd>${(perSecond(e.annual) < 10 ? fmt[1] : fmt[0]).format(perSecond(e.annual))} MWh</dd></div>
          <div><dt>Change / yr</dt><dd class="${g == null ? "" : goodBadClass(g * 100, 1)}">${C.trendText(g)}</dd></div>
          <div><dt>${e.lastYear} official</dt><dd>${energy(e.lastValue)}</dd></div>
          <div><dt>${YEAR} expected</dt><dd>${energy(e.annual)}</dd></div>
          <div><dt>Since you opened this page</dt><dd class="since">0 MWh</dd></div>
        </dl>
        ${e.cm ? cardGoalHtml(e.cm) : ""}
        ${"shareSeries" in e && e.years ? `<button type="button" class="more" aria-expanded="false">Yearly data <span aria-hidden="true">▾</span></button>${historyTable(/** @type {any} */ (e))}` : ""}
      </details>`;
    C.wireHistory(el);
    grid.appendChild(el);
    const rate = perSecond(e.annual);
    return {
      e, el, rate, nf: fmt[counterDecimals(rate)],
      num: el.querySelector(".num"), since: el.querySelector(".since"),
      mark: /** @type {HTMLElement | null} */ (el.querySelector(".cg-mark"))
    };
  });

  // Sorting ("On track to triple" only in the All view, where cards carry the goal)
  const sortSel = /** @type {HTMLSelectElement} */ ($("sort"));
  const hasGoal = srcKey === "all" && !!cap;
  const goalOpt = /** @type {HTMLOptionElement} */ (sortSel.querySelector('option[value="goal"]'));
  goalOpt.hidden = goalOpt.disabled = !hasGoal;   // Safari ignores "hidden" on options, so also disable it
  if (sortSel.value === "goal" && !hasGoal) sortSel.value = "total";
  /** @type {Record<string, (c: typeof cards[number]) => number | string>} */
  const keys = {
    total: (c) => c.e.annual,
    share: (c) => c.e.share ?? NaN,
    growth: (c) => c.e.growth ?? NaN,
    goal: (c) => (c.e.cm ? c.e.cm.p.growth - c.e.cm.needed : NaN),
    name: (c) => c.e.name
  };
  const sortCards = () => C.sortInto(grid, cards, keys[sortSel.value]);
  sortSel.onchange = sortCards;
  sortCards();
  C.wireShowAll(grid, $("show-all"), cards.length);

  C.startTicker((now) => {
    const frac = C.yearFraction(now), t = C.tYears(now), elapsed = (now - T0) / 1000;
    setText($("world-num"), C.digits(fmt[0].format(world.annual * MWH_PER_TWH * frac)), true);
    setText($("world-since"), fmt[0].format(wRate * elapsed));
    setText($("world-pct"), fmt[2].format(frac * 100));
    $("world-bar").style.width = frac * 100 + "%";
    for (const c of cards) {
      setText(c.num, c.nf.format(c.e.annual * MWH_PER_TWH * frac));
      setText(c.since, c.nf.format(c.rate * elapsed) + " MWh");
      if (c.mark && c.e.cm) c.mark.style.left = Math.min(c.e.cm.path(t) / c.e.cm.goal, 1) * 100 + "%";
    }
    goalTick?.(t);
  });
}

/** World electricity mix for the latest year, shown in the help pop-up. @param {import("./model.js").YearMix} v */
function renderMix(v) {
  /** @type {[string, number, string][]} */
  const rows = [
    ["Solar", v.solar, "#ffc53d"], ["Wind", v.wind, "#5ec8ff"], ["Hydro", v.hydro, "#4f8dff"],
    ["Bioenergy & other", v.bio + v.otherRen, "#3ddc84"], ["Nuclear", v.nuclear, "#c9a2ff"],
    ["Gas", v.gas, "#8c9a95"], ["Coal", v.coal, "#5d6661"], ["Oil", v.oil, "#6f6a5e"]
  ];
  const max = Math.max(...rows.map((r) => r[1]));
  $("mix").innerHTML = rows.map(([name, x, color]) => `
    <div class="mix-row"><span>${escapeHtml(name)}</span>
      <div class="mix-bar"><i style="width:${(x / max) * 100}%;background:${color}"></i></div>
      <b>${pct((x / v.total) * 100)}</b></div>`).join("");
}

// ---- Boot and source switching -----------------------------------------------------------
/** @param {SourceKey} key */
function applyLabels(key) {
  const src = CFG.sources[key];
  document.body.dataset.src = key;
  document.title = key === "all"
    ? "Live Renewable Energy Clock: World and Countries in Real Time"
    : `Live ${src.label} Power Clock: World and Countries in Real Time`;
  C.fill("src-label", src.label);
  C.fill("src-long", src.long);
  document.querySelectorAll(".gas-switch button").forEach((b) =>
    b.setAttribute("aria-pressed", String(/** @type {HTMLElement} */ (b).dataset.src === key)));
}

// Capacity (for the COP28 goal) loads in the background: the clock renders without it, and the goal
// section and card bars appear when it arrives. "Try again" retries it if it failed.
/** @type {Record<string, Record<number, number>> | null} */
let cap = null;
function startCapacity() {
  if (cap) return;
  loadCapacity()
    .then((c) => {
      goalTick = renderGoal(c);
      cap = c;
      if (current && document.body.dataset.state === "ready") show(current);   // re-render cards with goal bars
    })
    .catch((err) => console.error("Capacity data unavailable:", err));
}

/** @type {SourceKey | null} */
let current = null;
/** @param {string} key */
async function show(key) {
  const k = /** @type {SourceKey} */ (Object.hasOwn(CFG.sources, key) ? key : CFG.defaultSource);
  current = k;
  applyLabels(k);
  try {
    const { data, fetchedAt } = await loadGeneration();
    if (current !== k) return;   // switched again while loading
    render(data, cap, k);
    $("fetched-at").textContent = fetchedAt.toLocaleString();
    C.setState("ready");
  } catch (err) {
    if (current !== k) return;
    console.error(err);
    C.stopTicker();
    C.setState("error", err instanceof Error ? err.message : String(err));
  }
}

const fromHash = () => location.hash.slice(1);
document.querySelectorAll(".gas-switch button").forEach((b) => b.addEventListener("click", () => {
  const src = /** @type {HTMLElement} */ (b).dataset.src ?? CFG.defaultSource;
  history.replaceState(null, "", location.pathname + location.search + (src === CFG.defaultSource ? "" : "#" + src));
  show(src);
}));
window.addEventListener("hashchange", () => show(fromHash()));

C.wireHelp();
C.fill("year", YEAR);
C.fill("source", CFG.source);
C.fill("cap-source", CFG.capacity.source);
document.querySelectorAll("[data-source-url]").forEach((el) => { if (el instanceof HTMLAnchorElement) el.href = CFG.sourceUrl; });
$("retry").addEventListener("click", () => { C.setState("loading"); startCapacity(); show(current ?? CFG.defaultSource); });
startCapacity();
show(fromHash());
