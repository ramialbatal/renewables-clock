(function () {
  "use strict";

  const CFG = window.RE_CONFIG;
  const C = window.ClockCore;
  const { YEAR, fmt, pct, setText } = C;
  const $ = (id) => document.getElementById(id);
  const MWH_PER_TWH = 1e6;

  // ---- Data: electricity generation by source (Ember / Energy Institute via OWID) ----
  // The "full" CSV (every country, every year, about 150 KB compressed) is used because
  // OWID's "filtered" CSV silently drops years with any blank cell, which removes
  // countries such as Saudi Arabia that have no hydro figure. Rows are filtered here.
  const codes = [CFG.world, ...CFG.countries.map((c) => c.code)];

  const loadGeneration = C.once(async () => {
    const q = new URLSearchParams({ ...(CFG.chartParams || {}), v: "1", csvType: "full", useColumnShortNames: "true" });
    const rows = await C.fetchCsv(`${CFG.apiBase}${CFG.chart}.csv?${q}`);
    const wanted = new Set(codes), keys = Object.keys(CFG.columns), out = {};
    for (const r of rows) {
      if (!wanted.has(r.code) || +r.year < CFG.historyFrom) continue;
      const v = {};
      let any = false, total = 0;
      for (const k of keys) {
        const x = parseFloat(r[CFG.columns[k]]);
        v[k] = isFinite(x) ? x : 0;
        if (isFinite(x)) any = true;
        total += v[k];
      }
      if (!any || total <= 0) continue;
      v.total = total;
      (out[r.code] ||= { name: r.entity, years: {} }).years[+r.year] = v;
    }
    if (!out[CFG.world]) throw new Error("World total missing from response");
    return { data: out, fetchedAt: new Date() };
  });

  // ---- Data: installed renewable capacity (IRENA via OWID indicator API) ----------
  // -> { CODE: { year: GW } } (end-of-year values). Optional: the page works without it.
  const loadCapacity = C.once(async () => {
    const K = CFG.capacity, base = `${K.apiBase}${K.indicator}`;
    const [d, meta] = await Promise.all([C.fetchJson(`${base}.data.json`), C.fetchJson(`${base}.metadata.json`)]);
    const codeOf = {};
    for (const e of meta.dimensions.entities.values) codeOf[e.id] = e.code;
    const wanted = new Set(codes), out = {};
    d.values.forEach((v, i) => {
      const code = codeOf[d.entities[i]];
      if (wanted.has(code) && isFinite(v)) (out[code] ||= {})[d.years[i]] = v;
    });
    if (!out[CFG.world]) throw new Error("World capacity missing");
    return out;
  });

  // Sum the chosen source's columns into a { year: TWh } series.
  function seriesFor(entity, src) {
    const parts = CFG.sources[src].parts, s = {};
    for (const [y, v] of Object.entries(entity.years)) s[y] = parts.reduce((a, p) => a + v[p], 0);
    return s;
  }

  // Rates are in MWh; annual figures are in TWh.
  const perSecond = (annualTwh) => (annualTwh * MWH_PER_TWH) / C.SEC_PER_YEAR;

  function energy(twh) {
    if (Math.abs(twh) >= 100) return fmt[0].format(twh) + " TWh";
    if (Math.abs(twh) >= 1) return fmt[1].format(twh) + " TWh";
    return fmt[0].format(twh * 1000) + " GWh";
  }

  // ---- Capacity goal model -------------------------------------------------
  // IRENA values are end-of-year, so value(y) sits at fractional year y + 1.
  // Capacity now grows from the latest value at the latest growth rate.
  // The on-track path compounds evenly from the base year to the target.
  function capacityModel(series, target) {
    const K = CFG.capacity;
    const p = C.project(series, 1);
    const baseVal = series[K.base];
    const goal = target ?? baseVal * 3;
    const tBase = K.base + 1, tGoal = K.targetYear + 1, tLast = p.lastYear + 1;
    const now = (t) => p.lastValue * Math.pow(1 + p.growth, t - tLast);
    const path = (t) => baseVal * Math.pow(goal / baseVal, (t - tBase) / (tGoal - tBase));
    const needed = C.neededGrowth(p.lastValue, goal, tGoal - tLast);
    const done = p.lastValue >= goal;
    const v = done ? { cls: "ok", text: "Tripled" } : C.verdict(p.growth, needed);
    return { p, baseVal, goal, now, path, needed, verdict: v, multiple: p.lastValue / baseVal };
  }

  function renderGoal(cap) {
    const K = CFG.capacity;
    const m = capacityModel(cap[CFG.world], K.target);
    C.fill("cap-base-year", K.base);
    C.fill("cap-target-year", K.targetYear);
    C.fill("cap-last-year", m.p.lastYear);
    $("cap-target").textContent = fmt[0].format(K.target);
    $("cap-base").textContent = fmt[0].format(m.baseVal);
    $("cap-last").textContent = fmt[0].format(m.p.lastValue);
    $("cap-growth").textContent = pct(m.p.growth * 100);
    $("cap-needed").textContent = pct(m.needed * 100);
    const vd = $("cap-verdict");
    vd.textContent = m.verdict.text;
    vd.className = "verdict " + m.verdict.cls;
    $("goal").hidden = false;
    return (t) => {
      const now = m.now(t);
      setText($("cap-now"), fmt[0].format(now * 1000));          // MW, ticks visibly
      setText($("cap-pct"), pct((now / K.target) * 100, 2));
      $("cap-bar").style.width = Math.min(now / K.target, 1) * 100 + "%";
      $("cap-mark").style.left = Math.min(m.path(t) / K.target, 1) * 100 + "%";
      setText($("cap-path"), fmt[0].format(m.path(t)));
    };
  }

  function cardGoal(series) {
    if (!series || !series[CFG.capacity.base]) return null;
    const m = capacityModel(series);
    const html = `<div class="card-goal">
        <div class="goal-bar" title="Installed renewable capacity toward 3× its ${CFG.capacity.base} level by ${CFG.capacity.targetYear}">
          <i style="width:${Math.min(m.multiple / 3, 1) * 100}%"></i><span class="cg-mark"></span></div>
        <p><span>Capacity ×${fmt[1].format(m.multiple)} vs ${CFG.capacity.base} · goal ×3 by ${CFG.capacity.targetYear}</span>
          <span class="verdict ${m.verdict.cls}" title="Growth ${pct(m.p.growth * 100)} a year, needs ${
            m.verdict.text === "Tripled" ? "none" : pct(m.needed * 100)}">${m.verdict.text}</span></p>
      </div>`;
    return { html, m };
  }

  // ---- Rendering -----------------------------------------------------------
  function sparkFor(e) {
    const vals = e.years.map((y) => e.series[y]);
    const first = e.years[0], last = e.years[e.years.length - 1];
    const change = vals[0] > 0 ? (vals[vals.length - 1] / vals[0] - 1) * 100 : null;
    return C.sparkline(e.years, vals, {
      caption: `${first}-${String(last).slice(2)}`, change,
      changeText: change == null ? "new" : C.signed(change) + "%", good: "up"
    });
  }

  function historyTable(e) {
    const rows = e.years.slice().reverse().map((y) => {
      const prev = e.series[y - 1];
      const ch = prev ? (e.series[y] / prev - 1) * 100 : null;
      return `<tr><th>${y}</th><td>${energy(e.series[y])}</td><td>${pct(e.shareSeries[y])}</td><td class="${
        ch > 0 ? "up" : ch < 0 ? "down" : ""}">${ch == null ? "" : C.signed(ch, fmt[1]) + "%"}</td></tr>`;
    }).join("");
    return `<div class="history" hidden><table><caption>Official annual generation, share of electricity, change</caption>${rows}</table></div>`;
  }

  const T0 = Date.now();   // page-open time, shared by all sources
  let goalTick = null;     // set once capacity data arrives

  function render(data, cap, srcKey) {
    const src = CFG.sources[srcKey];
    const make = (entity) => {
      const series = seriesFor(entity, srcKey);
      const e = C.project(series, CFG.trendYears, CFG.maxGrowth ?? Infinity);
      e.shareSeries = {};
      for (const y of e.years) e.shareSeries[y] = (series[y] / entity.years[y].total) * 100;
      e.share = e.shareSeries[e.lastYear];
      return e;
    };

    const worldData = data[CFG.world];
    const world = make(worldData);
    const wRate = perSecond(world.annual);

    const entries = CFG.countries
      .filter((c) => data[c.code])
      .map((c) => ({ ...c, ...make(data[c.code]), name: c.name || data[c.code].name }));
    const missing = CFG.countries.filter((c) => !data[c.code]).map((c) => c.code);
    if (missing.length) console.warn("No data returned for:", missing.join(", "));

    const top = entries.filter((e) => !e.partOf);
    const listedAnnual = top.reduce((s, e) => s + e.annual, 0);
    const restLast = world.lastValue - top.reduce((s, e) => s + (e.series[world.lastYear] || 0), 0);
    entries.push({
      code: "ROW", flag: "🌐", name: "Rest of world", rest: true,
      annual: Math.max(world.annual - listedAnnual, 0), lastValue: restLast, lastYear: world.lastYear,
      growth: null, share: null
    });

    // Header / methodology fill-ins
    C.fill("latest", world.lastYear);
    C.fill("first", world.years[0]);
    C.fill("trend-from", world.trendFrom);
    $("world-rate").textContent = fmt[0].format(wRate);
    $("world-annual").textContent = fmt[0].format(world.annual);
    $("world-official").textContent = fmt[0].format(world.lastValue);
    $("world-growth").textContent = C.signed(world.growth * 100, fmt[1]) + "%";
    $("world-share").textContent = pct(world.share);
    $("world-share-first").textContent = pct(world.shareSeries[world.years[0]]);
    renderMix(worldData.years[world.lastYear]);

    const grid = $("grid");
    grid.innerHTML = "";
    const cards = entries.map((e) => {
      const shareOfWorld = (e.annual / world.annual) * 100;
      const g = e.growth;
      const cg = srcKey === "all" && !e.rest && cap ? cardGoal(cap[e.code]) : null;
      e.capGrowth = cg ? cg.m.p.growth - cg.m.needed : null;
      const el = document.createElement("article");
      el.className = "card" + (e.rest ? " rest" : "");
      el.innerHTML = `
        <header>
          <span class="flag" aria-hidden="true">${e.flag}</span>
          <h3>${e.name}</h3>
          ${e.partOf ? `<span class="tag">part of ${e.partOf}</span>` : ""}
          ${e.years ? sparkFor(e) : ""}
        </header>
        <div class="ytd"><span class="num">0</span> <small>MWh in ${YEAR}</small></div>
        <div class="bar" title="${e.share != null ? fmt[1].format(e.share) + "% of its electricity" : ""}"><i style="width:${Math.min(e.share ?? 0, 100)}%"></i></div>
        <dl>
          <div><dt>Share of its electricity</dt><dd>${e.share != null ? pct(e.share) : "n/a"}</dd></div>
          <div><dt>Share of world ${src.label.toLowerCase()}</dt><dd>${pct(shareOfWorld)}</dd></div>
          <div><dt>Per second</dt><dd>${(perSecond(e.annual) < 10 ? fmt[1] : fmt[0]).format(perSecond(e.annual))} MWh</dd></div>
          <div><dt>Trend / yr</dt><dd class="${g > 0 ? "up" : g < 0 ? "down" : ""}">${
            g == null ? "n/a" : (g > 0 ? "▲ +" : g < 0 ? "▼ " : "") + fmt[1].format(g * 100) + "%"}</dd></div>
          <div><dt>${e.lastYear} official</dt><dd>${energy(e.lastValue)}</dd></div>
          <div><dt>${YEAR} projected</dt><dd>${energy(e.annual)}</dd></div>
          <div class="wide"><dt>Since you opened this page</dt><dd class="since">0 MWh</dd></div>
        </dl>
        ${cg ? cg.html : ""}
        ${e.years ? `<button type="button" class="more" aria-expanded="false">Yearly data <span aria-hidden="true">▾</span></button>${historyTable(e)}` : ""}`;
      C.wireHistory(el);
      grid.appendChild(el);
      return {
        e, el, num: el.querySelector(".num"), since: el.querySelector(".since"), rate: perSecond(e.annual),
        mark: el.querySelector(".cg-mark"), cg
      };
    });

    // Sorting ("On track" only makes sense in the All view, where cards carry the goal)
    const sortSel = $("sort");
    sortSel.querySelector('option[value="goal"]').hidden = !(srcKey === "all" && cap);
    if (sortSel.value === "goal" && !(srcKey === "all" && cap)) sortSel.value = "total";
    const keys = {
      total: (c) => c.e.annual,
      share: (c) => c.e.share ?? -1,
      growth: (c) => c.e.growth ?? -99,
      goal: (c) => c.e.capGrowth ?? -99,
      name: (c) => c.e.name
    };
    const sortCards = () => C.sortInto(grid, cards, keys[sortSel.value]);
    sortSel.onchange = sortCards;
    sortCards();

    // Clock
    C.startTicker((now) => {
      const frac = C.yearFraction(now), t = C.tYears(now), elapsed = (now - T0) / 1000;
      setText($("world-num"), C.digits(fmt[0].format(world.annual * MWH_PER_TWH * frac)), true);
      setText($("world-since"), fmt[0].format(wRate * elapsed));
      setText($("world-pct"), fmt[2].format(frac * 100));
      $("world-bar").style.width = frac * 100 + "%";
      for (const c of cards) {
        setText(c.num, fmt[0].format(c.e.annual * MWH_PER_TWH * frac));
        setText(c.since, fmt[0].format(c.rate * elapsed) + " MWh");
        if (c.mark) c.mark.style.left = Math.min(c.cg.m.path(t) / c.cg.m.goal, 1) * 100 + "%";
      }
      if (goalTick) goalTick(t);
    });
  }

  // World electricity mix for the latest year, shown in the help pop-up.
  function renderMix(v) {
    const rows = [
      ["Solar", v.solar, "#ffc53d"], ["Wind", v.wind, "#5ec8ff"], ["Hydro", v.hydro, "#4f8dff"],
      ["Bioenergy & other", v.bio + v.otherRen, "#3ddc84"], ["Nuclear", v.nuclear, "#c9a2ff"],
      ["Gas", v.gas, "#8c9a95"], ["Coal", v.coal, "#5d6661"], ["Oil", v.oil, "#6f6a5e"]
    ];
    const max = Math.max(...rows.map((r) => r[1]));
    $("mix").innerHTML = rows.map(([name, x, color]) => `
      <div class="mix-row"><span>${name}</span>
        <div class="mix-bar"><i style="width:${(x / max) * 100}%;background:${color}"></i></div>
        <b>${pct((x / v.total) * 100)}</b></div>`).join("");
  }

  // ---- Boot / source switching --------------------------------------------
  function applyLabels(key) {
    const src = CFG.sources[key];
    document.body.dataset.src = key;
    document.title = key === "all"
      ? "Live Renewable Energy Clock: World and Countries in Real Time"
      : `Live ${src.label} Power Clock: World and Countries in Real Time`;
    document.querySelectorAll("[data-src-label]").forEach((el) => (el.textContent = src.label));
    document.querySelectorAll("[data-src-long]").forEach((el) => (el.textContent = src.long));
    document.querySelectorAll(".gas-switch button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.src === key)));
  }

  // Capacity is a bonus: if it fails, the goal section stays hidden and the clock still works.
  const capReady = loadCapacity().then((cap) => { goalTick = renderGoal(cap); return cap; })
    .catch((err) => { console.error("Capacity data unavailable:", err); return null; });

  let current = null;
  async function show(key) {
    if (!CFG.sources[key]) key = CFG.defaultSource;
    current = key;
    applyLabels(key);
    try {
      const [{ data, fetchedAt }, cap] = await Promise.all([loadGeneration(), capReady]);
      if (current !== key) return;  // user switched again while loading
      render(data, cap, key);
      $("fetched-at").textContent = fetchedAt.toLocaleString();
      C.setState("ready");
    } catch (err) {
      if (current !== key) return;
      console.error(err);
      C.stopTicker();
      C.setState("error", err.message || String(err));
    }
  }

  const fromHash = () => {
    const h = location.hash.slice(1);
    return CFG.sources[h] ? h : CFG.defaultSource;
  };
  document.querySelectorAll(".gas-switch button").forEach((b) =>
    b.addEventListener("click", () => {
      const hash = b.dataset.src === CFG.defaultSource ? "" : "#" + b.dataset.src;
      history.replaceState(null, "", location.pathname + location.search + hash);
      show(b.dataset.src);
    }));
  window.addEventListener("hashchange", () => show(fromHash()));

  C.wireHelp();
  C.fill("year", YEAR);
  C.fill("source", CFG.source);
  $("retry").addEventListener("click", () => { C.setState("loading"); show(current); });
  show(fromHash());
})();
