// @ts-check
/**
 * English words used by the code (messages.js and app.js). The page's own text is written in English in index.html;
 * fr.js, es.js and ar.js translate both: every key here, plus every data-i18n key in index.html.
 * Placeholders like {pct} are filled by clock-core's t(); keep them, in any order, in every translation.
 * Energy sources' names live in config.js; translations give them as "src.<key>.label" (the button), "src.<key>.long"
 * and "src.<key>.inText" (the name inside a sentence, which each language shapes to fit its own sentences).
 */
export default {
  // Page title, per view
  "meta.title.all": "Live Renewable Energy Clock: World and Countries in Real Time",
  "meta.title.solar": "Live Solar Power Clock: World and Countries in Real Time",
  "meta.title.wind": "Live Wind Power Clock: World and Countries in Real Time",
  "meta.title.hydro": "Live Hydro Power Clock: World and Countries in Real Time",

  // A source as the subject of a message ("solar power is booming"); messages.js capitalises the first letter
  "msg.power.clean": "clean power",
  "msg.power.all": "renewable power",
  "msg.power.solar": "solar power",
  "msg.power.wind": "wind power",
  "msg.power.hydro": "hydro power",

  // The answer at the top (messages.js)
  "msg.all.tripled.t": "Renewables have tripled",
  "msg.all.tripled.x": "The world has already met its goal of tripling clean power by {year}.",
  "msg.all.onTrack.t": "On track to triple clean power",
  "msg.all.onTrack.x": "Solar, wind and other clean power are growing fast enough to triple by {year}.",
  "msg.all.close.t": "Almost on track",
  "msg.all.close.x": "Clean power is growing fast, but not quite fast enough to triple by {year}.",
  "msg.all.offTrack.t": "Growing, but too slowly",
  "msg.all.offTrack.x": "Clean power is growing, but far too slowly to triple by {year}.",
  "msg.all.backwards.t": "Clean power is shrinking",
  "msg.all.backwards.x": "The world is moving away from its goal of tripling clean power by {year}.",
  "msg.src.boom.t": "{power} is booming",
  "msg.src.boom.x": "It grew {pct} in the latest year. Every unit of it means less coal and gas burned.",
  "msg.src.up.t": "{power} is growing",
  "msg.src.up.x": "It grew {pct} in the latest year, replacing some coal and gas.",
  "msg.src.flat.t": "{power} isn't growing",
  "msg.src.flat.x": "It stayed about the same in the latest year.",
  "msg.src.down.t": "{power} is falling",
  "msg.src.down.x": "It fell {pct} in the latest year. Dry years can cut hydropower, for example.",

  // Traffic lights (messages.js)
  "msg.goal.text": "{pct} of the way there. Growing {growth} a year; needs {needed}.",
  "msg.goal.done": "{pct} of the goal installed.",
  "msg.goal.tripled": "Goal reached",
  "msg.goal.onTrack": "On track",
  "msg.goal.close": "Almost there",
  "msg.goal.offTrack": "Too slow",
  "msg.goal.backwards": "Going backwards",
  "msg.share.t": "{pct} of the world's electricity",
  "msg.share.up": "Up from {pct} in {year}, a growing part of the world's power.",
  "msg.share.down": "Down from {pct} in {year}, a shrinking part of the world's power.",
  "msg.share.same": "The same as in {year}.",
  "msg.badge.up": "▲ Growing",
  "msg.badge.down": "▼ Shrinking",
  "msg.badge.flat": "● Steady",

  // The tripling goal (model.js and app.js)
  "goal.tripled": "Tripled",
  "a.goalLabel": "Goal: triple clean power by {year}",
  "a.ofGoal": "{pct} of the goal",
  "a.shareOf": "{power}'s share",
  "a.growingYet": "Growing this year?",
  "a.cardGoalTitle": "Installed renewable capacity toward 3× its {base} level by {year}",
  "a.cardGoal": "Capacity ×{multiple} vs {base} · goal ×3 by {year}",
  "a.cardGrowth": "Growth {pct} a year",
  "a.cardNeeds": ", needs {pct}",

  // Hero details (app.js): words that slot into the sentence in index.html
  "a.growing": "growing",
  "a.falling": "falling",
  "a.flat": "flat",
  "a.upFrom": "up from",
  "a.downFrom": "down from",
  "a.sameAs": "the same as",

  // Country cards (app.js)
  "a.rest": "Rest of world",
  "a.partOf": "part of {name}",
  "a.mwhIn": "MWh in {year}",
  "a.shareTitle": "{pct} of its electricity",
  "a.shareIs": "{pct} of its electricity is {name}",
  "a.shareWorld": "{pct} of the world's {name} power",
  "a.more": "More",
  "a.shareOfWorld": "Share of world {name}",
  "a.perSecond": "Per second",
  "a.change": "Change / yr",
  "a.official": "{year} official",
  "a.expected": "{year} expected",
  "a.since": "Since you opened this page",
  "a.new": "new",
  "a.spark": "{name}: annual generation {first} to {last}, {change}",
  "a.history": "Official annual generation, share of electricity, change",

  // The electricity mix in the help pop-up (app.js)
  "a.mix.solar": "Solar",
  "a.mix.wind": "Wind",
  "a.mix.hydro": "Hydro",
  "a.mix.bio": "Bioenergy & other",
  "a.mix.nuclear": "Nuclear",
  "a.mix.gas": "Gas",
  "a.mix.coal": "Coal",
  "a.mix.oil": "Oil",

  // "What can I do?" (js/actions.js)
  "act.power.t": "Choose clean power",
  "act.power.x": "If you can, pick a renewable electricity plan, join a community solar project or put panels on a roof. In many places solar is now the cheapest electricity ever.",
  "act.efficiency.t": "Use energy wisely",
  "act.efficiency.x": "Efficient appliances, LED bulbs and good insulation cut the power we need, so clean electricity covers more of it. Countries have agreed to double efficiency gains by 2030.",
  "act.grids.t": "Ask for faster connections",
  "act.grids.x": "Ask leaders to speed up permits and power lines: at least 3,000 gigawatts of renewable projects are waiting in line to connect to the grid.",
};
