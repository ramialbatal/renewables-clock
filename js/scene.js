// @ts-check
/**
 * Renewables Clock: the picture behind the top of the page. A warm sun over green hills, a lake, wind turbines
 * turning, solar panels catching the light and grass swaying in the breeze. The view on show gets a little more
 * attention: a brighter sun for solar, faster turbines for wind, a livelier lake for hydro. Drawn with a 2D canvas;
 * clock-core's startScene runs it (see app.js).
 */
import { seeded } from "clock-core";

/** @typedef {[number, number, number]} RGB */
/** @param {RGB} c @param {number} [a] */
const rgba = (c, a = 1) => `rgba(${c.join(",")},${a})`;

const SKY_TOP = /** @type {RGB} */ ([9, 22, 34]), SKY_MID = /** @type {RGB} */ ([24, 62, 82]), SKY_LOW = /** @type {RGB} */ ([226, 182, 110]);
const SUN = /** @type {RGB} */ ([255, 214, 120]);
const HILLS = /** @type {RGB[]} */ ([[40, 88, 84], [36, 108, 68], [42, 128, 70]]);
const GRASS = /** @type {RGB[]} */ ([[60, 156, 74], [86, 182, 88]]);
const TURBINE = /** @type {RGB} */ ([226, 236, 236]);

/** A soft round sprite, stamped for clouds and glows. */
function softDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext("2d"));
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.6, "rgba(255,255,255,.4)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return c;
}

/**
 * Build the renewables scene.
 * @param {() => string | undefined} source  the view on show ("all", "solar", "wind" or "hydro"), read every frame
 * @returns {import("clock-core").Scene}
 */
export function renewablesScene(source) {
  const dot = softDot();
  /** Hill heights every 4 px, far to near. @type {Float32Array[]} */ let hills = [];
  const STEP = 4;
  /** @type {{ x: number, y: number, size: number, speed: number, phase: number, layer: number }[]} */ let turbines = [];
  /** @type {{ x: number, y: number, n: number, size: number }[]} */ let panels = [];
  /** @type {{ x: number, h: number, lean: number, phase: number, shade: number }[]} */ let grass = [];
  /** @type {{ y: number, speed: number, off: number, size: number }[]} */ let clouds = [];
  // How much each view is emphasised, eased towards 1 for the view on show
  const focus = { solar: 0, wind: 0, hydro: 0 };
  let spin = 0, sway = 0;

  /** Height of hill layer i at x. @param {number} i @param {number} x */
  const hillY = (i, x) => hills[i][Math.max(0, Math.min(hills[i].length - 1, Math.round(x / STEP)))];

  return {
    layout(f) {
      const { w, ground: G } = f;
      const rnd = seeded(11);
      const n = Math.ceil(w / STEP) + 2;
      // Three layers of rolling hills; nearer ones are lower on screen and greener
      hills = [0.3, 0.17, 0.07].map((top, i) => {
        const a = new Float32Array(n), p1 = rnd() * 6, p2 = rnd() * 6, f1 = 0.004 + rnd() * 0.003, f2 = 0.011 + rnd() * 0.006;
        for (let k = 0; k < n; k++) {
          const x = k * STEP, wave = (Math.sin(x * f1 + p1) * 0.65 + Math.sin(x * f2 + p2) * 0.35 + 1) / 2;
          a[k] = G - G * top * (0.45 + 0.55 * wave) - (i === 2 ? 4 : 0);
        }
        return a;
      });
      // Wind turbines on the far and middle hills
      turbines = [];
      const count = Math.max(3, Math.round(w / 200));
      for (let i = 0; i < count; i++) {
        const layer = i % 3 === 1 ? 1 : 0, x = ((i + 0.2 + rnd() * 0.6) / count) * w;
        turbines.push({ x, y: hillY(layer, x) + 2, size: G * (layer ? 0.3 : 0.2) * (w < 600 ? 0.75 : 1) * (0.85 + rnd() * 0.3), speed: 0.7 + rnd() * 0.5, phase: rnd() * 6, layer });
      }
      // Solar panels on the near hill, left and right of the middle (the title sits above the middle)
      panels = [0.13, 0.9].map((p) => ({ x: w * p, y: hillY(2, w * p), n: w < 600 ? 2 : 4, size: Math.max(20, G * 0.075) }));
      // Grass along the top of the near hill
      grass = Array.from({ length: Math.round(w / 3) }, () => ({
        x: rnd() * w, h: (8 + rnd() * 14) * Math.max(0.8, G / 400), lean: (rnd() - 0.5) * 0.5, phase: rnd() * 6, shade: rnd() < 0.5 ? 0 : 1,
      }));
      clouds = Array.from({ length: 4 }, (_, i) => ({ y: G * (0.12 + i * 0.09), speed: 4 + rnd() * 5, off: rnd() * w, size: 60 + rnd() * 70 }));
    },

    draw(f) {
      const { ctx, w, h, ground: G, t, dt } = f;
      const view = source() ?? "all";
      for (const k of /** @type {const} */ (["solar", "wind", "hydro"])) {
        const target = view === k ? 1 : 0;
        focus[k] = dt ? focus[k] + (target - focus[k]) * Math.min(1, dt * 2) : target;
      }
      spin += dt * (1 + focus.wind * 1.4);
      sway += dt * (1 + focus.wind * 0.8);

      // Sky, dark at the top for the title, warm near the horizon
      const sky = ctx.createLinearGradient(0, 0, 0, G);
      sky.addColorStop(0, rgba(SKY_TOP)); sky.addColorStop(0.5, rgba(SKY_MID)); sky.addColorStop(1, rgba(SKY_LOW));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, G + 1);

      // The sun, with slowly turning rays (bigger and brighter in the solar view)
      // Low in the sky, beside the hills and below the header text
      const sx = w * (w < 600 ? 0.8 : 0.76), sy = G * (w < 600 ? 0.74 : 0.66), sr = Math.min(w, G) * 0.075 * (1 + focus.solar * 0.25);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.03);
      ctx.fillStyle = rgba(SUN, 0.05 + focus.solar * 0.05);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sr * 4.5, -sr * 0.3); ctx.lineTo(sr * 4.5, sr * 0.3); ctx.fill();
      }
      ctx.restore();
      const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4);
      glow.addColorStop(0, rgba(SUN, 0.5 + focus.solar * 0.2)); glow.addColorStop(1, rgba(SUN, 0));
      ctx.fillStyle = glow; ctx.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
      ctx.fillStyle = rgba([255, 236, 180]); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

      // Soft clouds drifting by
      ctx.globalAlpha = 0.16;
      for (const c of clouds) {
        const x = ((c.off + t * c.speed * (1 + focus.wind)) % (w + 300)) - 150;
        ctx.drawImage(dot, x - c.size, c.y - c.size * 0.3, c.size * 2, c.size * 0.6);
        ctx.drawImage(dot, x - c.size * 0.4, c.y - c.size * 0.45, c.size * 1.3, c.size * 0.7);
      }
      ctx.globalAlpha = 1;

      // A few birds
      ctx.strokeStyle = "rgba(10,20,24,.7)"; ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const x = ((t * (14 + i * 3) + i * 260) % (w + 120)) - 60, y = G * (0.22 + i * 0.05) + Math.sin(t * 0.7 + i) * 6;
        const flap = Math.sin(t * 6 + i * 2) * 3, s = 5 + i;
        ctx.beginPath(); ctx.moveTo(x - s, y - flap); ctx.quadraticCurveTo(x - s / 2, y - 2, x, y); ctx.quadraticCurveTo(x + s / 2, y - 2, x + s, y - flap); ctx.stroke();
      }

      /** Fill hill layer i down to the horizon. @param {number} i */
      const hill = (i) => {
        ctx.fillStyle = rgba(HILLS[i]);
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let k = 0; k < hills[i].length; k++) ctx.lineTo(k * STEP, hills[i][k]);
        ctx.lineTo(w, h); ctx.fill();
      };
      /** @param {number} layer */
      const drawTurbines = (layer) => {
        for (const tb of turbines) {
          if (tb.layer !== layer) continue;
          const top = tb.y - tb.size, blade = tb.size * 0.45, a0 = spin * tb.speed + tb.phase;
          ctx.strokeStyle = rgba(TURBINE, layer ? 0.95 : 0.75); ctx.lineCap = "round";
          ctx.lineWidth = Math.max(1.5, tb.size * 0.03);
          ctx.beginPath(); ctx.moveTo(tb.x, tb.y); ctx.lineTo(tb.x, top); ctx.stroke();
          ctx.lineWidth = Math.max(1.2, tb.size * 0.025);
          ctx.beginPath();
          for (let b = 0; b < 3; b++) {
            const a = a0 + (b * Math.PI * 2) / 3;
            ctx.moveTo(tb.x, top); ctx.lineTo(tb.x + Math.cos(a) * blade, top + Math.sin(a) * blade);
          }
          ctx.stroke();
          ctx.fillStyle = rgba(TURBINE); ctx.beginPath(); ctx.arc(tb.x, top, Math.max(1.5, tb.size * 0.03), 0, Math.PI * 2); ctx.fill();
        }
      };

      hill(0);
      drawTurbines(0);

      // A lake in the valleys, shimmering (livelier in the hydro view)
      const lakeTop = G - G * 0.13;
      const lake = ctx.createLinearGradient(0, lakeTop, 0, G);
      lake.addColorStop(0, "rgb(110,160,180)"); lake.addColorStop(1, "rgb(36,88,124)");
      ctx.fillStyle = lake; ctx.fillRect(0, lakeTop, w, G - lakeTop);
      ctx.fillStyle = `rgba(255,240,200,${0.25 + focus.hydro * 0.35})`;
      for (let i = 0; i < w / 14; i++) {
        const y = lakeTop + 3 + ((i * 7) % Math.max(1, G - lakeTop - 4)), x = (i * 53 + Math.sin(t * (0.8 + focus.hydro) + i) * 10) % w;
        const len = 6 + 8 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7));
        ctx.fillRect(x, y, len, 1);
      }

      hill(1);
      drawTurbines(1);
      hill(2);

      // Solar panels catching the light
      for (const p of panels) {
        for (let i = 0; i < p.n; i++) {
          const x = p.x + (i - p.n / 2) * p.size * 1.2, y = hillY(2, x) + 2, s = p.size;
          ctx.fillStyle = "rgba(20,28,36,.9)"; ctx.fillRect(x + s * 0.45, y - s * 0.3, 2, s * 0.3);
          const shine = 0.5 + 0.5 * Math.sin(t * 0.9 - i * 0.6 + p.x);
          ctx.fillStyle = `rgb(${Math.round(30 + 60 * shine * (0.6 + focus.solar))},${Math.round(60 + 70 * shine * (0.6 + focus.solar))},${Math.round(120 + 60 * shine)})`;
          ctx.beginPath(); ctx.moveTo(x, y - s * 0.3); ctx.lineTo(x + s * 0.2, y - s * 0.8); ctx.lineTo(x + s * 1.1, y - s * 0.8); ctx.lineTo(x + s * 0.9, y - s * 0.3); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "rgba(220,235,245,.7)"; ctx.lineWidth = 1; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + s * 0.1, y - s * 0.55); ctx.lineTo(x + s, y - s * 0.55); ctx.moveTo(x + s * 0.55, y - s * 0.3); ctx.lineTo(x + s * 0.65, y - s * 0.8);
          ctx.strokeStyle = "rgba(200,220,240,.35)"; ctx.stroke();
        }
      }

      // Grass swaying in the breeze
      for (let shade = 0; shade < 2; shade++) {
        ctx.fillStyle = rgba(GRASS[shade]);
        ctx.beginPath();
        for (const g of grass) {
          if (g.shade !== shade) continue;
          const base = hillY(2, g.x) + 3, bend = (Math.sin(sway * 1.3 + g.x * 0.015 + g.phase * 0.3) * 0.6 + g.lean) * g.h * 0.6;
          ctx.moveTo(g.x - 1.6, base); ctx.quadraticCurveTo(g.x + bend * 0.3, base - g.h * 0.6, g.x + bend, base - g.h); ctx.quadraticCurveTo(g.x + bend * 0.3 + 0.8, base - g.h * 0.5, g.x + 1.6, base);
        }
        ctx.fill();
      }

      // Green ground below the horizon, fading into the page
      const field = ctx.createLinearGradient(0, G, 0, h);
      field.addColorStop(0, "rgb(32,96,54)"); field.addColorStop(0.35, "rgb(18,46,30)"); field.addColorStop(1, "rgb(10,20,16)");
      ctx.fillStyle = field; ctx.fillRect(0, G, w, h - G);
    },
  };
}
