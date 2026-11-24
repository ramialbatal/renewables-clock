# Notes for AI assistants working in this repository

- This is the Renewables Clock, one of three open clocks (Emissions, Renewables, Jobs) built on
  [clock-core](https://github.com/ramialbatal/clock-core). Read `CONTRIBUTING.md`, then the developer notes in
  clock-core's `docs/` (especially `lessons-learned.md` and `adding-a-clock.md`) before changing anything.
- Plain ES modules, no build step. Settings in `js/config.js`, pure calculations in `js/model.js` (add a test in
  `test/model.test.js` for every change), plain-language messages in `js/messages.js` (tested in
  `test/messages.test.js`), page code in `js/app.js`.
- Page design: answer first, in plain words with a colour (green, amber, red); one short sentence per point; every
  number, method or source behind "More" or "How we calculate this". No jargon in what a visitor sees first.
- Never copy clock-core helpers into this repo; change clock-core, release it, then bump the pin in three places:
  the two clock-core URLs in `index.html` and the `clock-core` dev dependency in `package.json`.
- Colour and verdict logic must compare values as displayed (`C.shown` / `C.shownSign`), never raw numbers.
- Escape any data text put into HTML with `escapeHtml`; update live numbers only with `setText` inside the ticker.
- Writing style: no em dashes or en dashes anywhere (text, comments, images). Professional but approachable.
- Before finishing: `npm run check` and `npm run smoke` (use `CLOCK_CORE_DIR=../clock-core` to test against a local
  clock-core checkout).
