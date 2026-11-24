# Notes for AI assistants working in this repository

- This is the Renewables Clock, one of three open clocks (Emissions, Renewables, Jobs) built on
  [clock-core](https://github.com/ramialbatal/clock-core). Read `CONTRIBUTING.md`, then the developer notes in
  clock-core's `docs/` (especially `lessons-learned.md` and `adding-a-clock.md`) before changing anything.
- Plain ES modules, no build step. Settings in `js/config.js`, pure calculations in `js/model.js` (add a test in
  `test/model.test.js` for every change), page code in `js/app.js`.
- Never copy clock-core helpers into this repo; change clock-core, release it, then bump the pinned version in
  `index.html` (two URLs).
- Escape any data text put into HTML with `escapeHtml`; update live numbers only with `setText` inside the ticker.
- Writing style: no em dashes or en dashes anywhere (text, comments, images). Professional but approachable.
- Before finishing: `npm run check` and `npm run smoke` (use `CLOCK_CORE_DIR=../clock-core` to test against a local
  clock-core checkout).
