(function () {
  "use strict";

  const CFG = window.RE_CONFIG;
  const $ = (id) => document.getElementById(id);
  const MS_PER_YEAR = (y) => Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1);
  const YEAR = new Date().getUTCFullYear();
  const MWH_PER_TWH = 1e6;

  const fmt0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---- Fetching ------------------------------------------------------------
  // The "full" CSV (every country, every year, about 150 KB compressed) is used because
  // OWID's "filtered" CSV silently drops years with any blank cell, which removes
  // countries such as Saudi Arabia that have no hydro figure. Rows are filtered here instead.
  function chartUrl(slug) {
    const q = new URLSearchParams({
      ...(CFG.chartParams || {}),
      v: "1", csvType: "full", useColumnShortNames: "true"
    });
    return `${CFG.apiBase}${slug}.csv?${q}`;
  }

  // Minimal CSV parser (OWID quotes entity names that contain commas).
  function parseCsv(text) {
    const rows = [];
    for (const line of text.trim().split(/\r?\n/)) {
      const cells = [];
      let cur = "", q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') q = false;
          else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ",") { cells.push(cur); cur = ""; }
        else cur += ch;
      }
      cells.push(cur);
      rows.push(cells);
    }
    const [head, ...body] = rows;
    return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  }

  // -> { CODE: { name, years: { year: { solar, wind, ..., total } } } }
  function indexByCode(rows, codes) {
    const out = {};
    const wanted = new Set(codes);
    const keys = Object.keys(CFG.columns);
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
    return out;
  }

  let dataPromise = null;
  function loadData() {
    if (dataPromise) return dataPromise;
    const codes = [CFG.world, ...CFG.countries.map((c) => c.code)];
    dataPromise = fetch(chartUrl(CFG.chart))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} from Our World in Data`);
        return res.text();
      })
      .then((text) => {
        const data = indexByCode(parseCsv(text), codes);
        if (!data[CFG.world]) throw new Error("World total missing from response");
        return { data, fetchedAt: new Date() };
      })
      .catch((err) => { dataPromise = null; throw err; });
    return dataPromise;
  }

  // Sum the chosen source's columns into a { year: TWh } series.
  function seriesFor(entity, src) {
    const parts = CFG.sources[src].parts;
    const s = {};
    for (const [y, v] of Object.entries(entity.years)) s[y] = parts.reduce((a, p) => a + v[p], 0);
    return s;
  }

  // ---- Model ---------------------------------------------------------------
  // Latest official year L with value E(L); trend g = average annual change over
  // the last N years. Projection for this year: E(Y) = E(L) * (1 + g)^(Y - L).
  // That annual figure is spread evenly over the year (no seasonal cycle).
  function buildEntry(series, n) {
    const years = Object.keys(series).map(Number).sort((a, b) => a - b);
    const last = years[years.length - 1];
    const first = years.includes(last - n) ? last - n : years[0];
    const g = last > first && series[first] > 0
      ? Math.pow(series[last] / series[first], 1 / (last - first)) - 1 : 0;
    const gp = Math.min(g, CFG.maxGrowth ?? Infinity);   // growth used for the projection
    const annual = series[last] * Math.pow(1 + gp, YEAR - last);
    return { lastYear: last, lastValue: series[last], trendFrom: first, growth: g, annual, series, years };
  }
  // Rates are in MWh; annual figures are in TWh.
  const perSecond = (annualTwh) => (annualTwh * MWH_PER_TWH) / (MS_PER_YEAR(YEAR) / 1000);
  const yearFraction = (now) => (now - Date.UTC(YEAR, 0, 1)) / MS_PER_YEAR(YEAR);

  // ---- Rendering -----------------------------------------------------------
  function energy(twh) {
    if (Math.abs(twh) >= 100) return fmt0.format(twh) + " TWh";
    if (Math.abs(twh) >= 1) return fmt1.format(twh) + " TWh";
    return fmt0.format(twh * 1000) + " GWh";
  }
  const pct = (x) => fmt1.format(x) + "%";
  const digits = (s) => s.replace(/[0-9]/g, (d) => `<span class="d">${d}</span>`);

  function sparkline(e) {
    const ys = e.years, vals = ys.map((y) => e.series[y]);
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const W = 120, H = 28;
    const xy = vals.map((v, i) => [(i / Math.max(vals.length - 1, 1)) * W, H - 3 - ((v - min) / span) * (H - 6)]);
    const pts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const [lx, ly] = xy[xy.length - 1];
    const first = ys[0], last = ys[ys.length - 1];
    const change = vals[0] > 0 ? (vals[vals.length - 1] / vals[0] - 1) * 100 : null;
    const label = change == null ? "new" : (change > 0 ? "+" : "") + fmt0.format(change) + "%";
    return `<figure class="spark-wrap" title="Show yearly values">
      <svg class="spark" viewBox="-2 0 ${W + 4} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts}"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2"/>
      </svg>
      <figcaption>${first}-${String(last).slice(2)} <b class="${change > 0 ? "up" : change < 0 ? "down" : ""}">${label}</b></figcaption>
      <span class="sr-only">Annual generation ${first} to ${last}</span>
    </figure>`;
  }

  function historyTable(e) {
    const rows = e.years.slice().reverse().map((y) => {
      const prev = e.series[y - 1];
      const ch = prev ? (e.series[y] / prev - 1) * 100 : null;
      return `<tr><th>${y}</th><td>${energy(e.series[y])}</td><td>${pct(e.shareSeries[y])}</td><td class="${
        ch > 0 ? "up" : ch < 0 ? "down" : ""}">${ch == null ? "" : (ch > 0 ? "+" : "") + fmt1.format(ch) + "%"}</td></tr>`;
    }).join("");
    return `<div class="history" hidden><table><caption>Official annual generation, share of electricity, change</caption>${rows}</table></div>`;
  }

  const T0 = Date.now();   // page-open time, shared by all sources
  let loopId = 0;          // bumps on every render so the old clock loop stops

  function render(data, srcKey) {
    const myLoop = ++loopId;
    const src = CFG.sources[srcKey];

    const make = (entity) => {
      const series = seriesFor(entity, srcKey);
      const e = buildEntry(series, CFG.trendYears);
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
    document.querySelectorAll("[data-latest]").forEach((el) => (el.textContent = world.lastYear));
    document.querySelectorAll("[data-first]").forEach((el) => (el.textContent = world.years[0]));
    document.querySelectorAll("[data-trend-from]").forEach((el) => (el.textContent = world.trendFrom));
    $("world-rate").textContent = fmt0.format(wRate);
    $("world-annual").textContent = fmt0.format(world.annual);
    $("world-official").textContent = fmt0.format(world.lastValue);
    $("world-growth").textContent = (world.growth >= 0 ? "+" : "") + fmt1.format(world.growth * 100) + "%";
    $("world-share").textContent = pct(world.share);
    $("world-share-first").textContent = pct(world.shareSeries[world.years[0]]);
    renderMix(worldData.years[world.lastYear]);

    const grid = $("grid");
    grid.innerHTML = "";
    const cards = entries.map((e) => {
      const shareOfWorld = (e.annual / world.annual) * 100;
      const g = e.growth;
      const el = document.createElement("article");
      el.className = "card" + (e.rest ? " rest" : "");
      el.innerHTML = `
        <header>
          <span class="flag" aria-hidden="true">${e.flag}</span>
          <h3>${e.name}</h3>
          ${e.partOf ? `<span class="tag">part of ${e.partOf}</span>` : ""}
          ${e.years ? sparkline(e) : ""}
        </header>
        <div class="ytd"><span class="num">0</span> <small>MWh in ${YEAR}</small></div>
        <div class="bar" title="${e.share != null ? fmt1.format(e.share) + "% of its electricity" : ""}"><i style="width:${Math.min(e.share ?? 0, 100)}%"></i></div>
        <dl>
          <div><dt>Share of its electricity</dt><dd>${e.share != null ? pct(e.share) : "n/a"}</dd></div>
          <div><dt>Share of world ${src.label.toLowerCase()}</dt><dd>${pct(shareOfWorld)}</dd></div>
          <div><dt>Per second</dt><dd>${(perSecond(e.annual) < 10 ? fmt1 : fmt0).format(perSecond(e.annual))} MWh</dd></div>
          <div><dt>Trend / yr</dt><dd class="${g > 0 ? "up" : g < 0 ? "down" : ""}">${
            g == null ? "n/a" : (g > 0 ? "▲ +" : g < 0 ? "▼ " : "") + fmt1.format(g * 100) + "%"}</dd></div>
          <div><dt>${e.lastYear} official</dt><dd>${energy(e.lastValue)}</dd></div>
          <div><dt>${YEAR} projected</dt><dd>${energy(e.annual)}</dd></div>
          <div class="wide"><dt>Since you opened this page</dt><dd class="since">0 MWh</dd></div>
        </dl>
        ${e.years ? `<button type="button" class="more" aria-expanded="false">Yearly data <span aria-hidden="true">▾</span></button>${historyTable(e)}` : ""}`;
      const sw = el.querySelector(".spark-wrap");
      const btn = el.querySelector(".more");
      if (btn) {
        const h = el.querySelector(".history");
        const toggle = () => {
          h.hidden = !h.hidden;
          btn.setAttribute("aria-expanded", String(!h.hidden));
          btn.firstChild.textContent = h.hidden ? "Yearly data " : "Hide yearly data ";
          btn.classList.toggle("open", !h.hidden);
        };
        btn.addEventListener("click", toggle);
        sw.addEventListener("click", toggle);
      }
      grid.appendChild(el);
      return { e, el, num: el.querySelector(".num"), since: el.querySelector(".since"), rate: perSecond(e.annual) };
    });

    // Sorting
    const sortSel = $("sort");
    const keys = {
      total: (c) => c.e.annual,
      share: (c) => c.e.share ?? -1,
      growth: (c) => c.e.growth ?? -99,
      name: (c) => c.e.name
    };
    function sortCards() {
      const k = keys[sortSel.value];
      cards.slice()
        .sort((a, b) => (!!a.e.rest - !!b.e.rest) ||
          (typeof k(a) === "string" ? k(a).localeCompare(k(b)) : k(b) - k(a)))
        .forEach((c) => grid.appendChild(c.el));
    }
    sortSel.onchange = sortCards;
    sortCards();

    // Clock loop
    let lastWorld = "";
    (function tick() {
      if (myLoop !== loopId) return;
      const now = Date.now();
      const frac = yearFraction(now);
      const elapsed = (now - T0) / 1000;
      const ws = fmt0.format(world.annual * MWH_PER_TWH * frac);
      if (ws !== lastWorld) { $("world-num").innerHTML = digits(ws); lastWorld = ws; }
      $("world-since").textContent = fmt0.format(wRate * elapsed);
      $("world-pct").textContent = fmt2.format(frac * 100);
      $("world-bar").style.width = frac * 100 + "%";
      for (const c of cards) {
        c.num.textContent = fmt0.format(c.e.annual * MWH_PER_TWH * frac);
        c.since.textContent = fmt0.format(c.rate * elapsed) + " MWh";
      }
      requestAnimationFrame(tick);
    })();
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
  function setState(state, msg) {
    document.body.dataset.state = state;
    if (msg) $("error-msg").textContent = msg;
  }

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

  let current = null;
  async function show(key) {
    if (!CFG.sources[key]) key = CFG.defaultSource;
    current = key;
    applyLabels(key);
    try {
      const { data, fetchedAt } = await loadData();
      if (current !== key) return;  // user switched again while loading
      render(data, key);
      $("fetched-at").textContent = fetchedAt.toLocaleString();
      setState("ready");
    } catch (err) {
      if (current !== key) return;
      console.error(err);
      setState("error", err.message || String(err));
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

  // Help pop-up
  const help = $("help");
  document.querySelectorAll("[data-open-help]").forEach((b) => b.addEventListener("click", () => {
    if (help.showModal) help.showModal(); else help.setAttribute("open", "");
    help.querySelector(".sheet").scrollTop = 0;
    help.querySelector(".close").focus({ preventScroll: true });
  }));
  const closeHelp = () => (help.close ? help.close() : help.removeAttribute("open"));
  document.querySelectorAll("[data-close-help]").forEach((b) => b.addEventListener("click", closeHelp));
  help.addEventListener("click", (e) => { if (e.target === help) closeHelp(); });  // tap outside

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = YEAR));
  document.querySelectorAll("[data-source]").forEach((el) => (el.textContent = CFG.source));
  $("retry").addEventListener("click", () => show(current));
  show(fromHash());
})();
