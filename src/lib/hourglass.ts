/*
 * The hourglass face's geometry, kept apart from the drawing so it can be tested. Both bulbs share one
 * profile: a rounded shoulder under the cap, swelling, then tapering into a narrow neck. The sand is
 * measured by volume (each slice of a round bulb holds width²), so the level moves the way real sand does:
 * slowly while the wide part drains, quickly through the narrow part.
 */

export const GLASS = {
  top: 15, // where the top bulb meets the cap
  neck: 86,
  bottom: 157, // where the bottom bulb meets the base
  centre: 60,
  radius: 37, // half the width at the widest
  neckRadius: 2,
} as const;

/** How full the glass is: the share of one bulb's volume the sand takes up. Real ones are never brimming. */
export const FILL = 0.78;

const HALF = GLASS.neck - GLASS.top;
const STEPS = 120;

/** Half the bulb's width, `t` of the way from the cap (0) to the neck (1). */
export function halfWidth(t: number) {
  const taper = Math.pow(1 - Math.pow(Math.min(Math.max(t, 0), 1), 2.2), 0.8);
  const shoulder = 0.86 + 0.14 * Math.sin((Math.min(t / 0.22, 1) * Math.PI) / 2);
  return GLASS.neckRadius + (GLASS.radius - GLASS.neckRadius) * taper * shoulder;
}

// cumulative volume from the cap towards the neck, in STEPS slices
const volume: number[] = [0];
for (let i = 1; i <= STEPS; i++) {
  const w = halfWidth((i - 0.5) / STEPS);
  volume.push(volume[i - 1] + w * w);
}
const BULB = volume[STEPS];

/** Where `t` the volume from the cap reaches `v`. */
function reach(v: number) {
  if (v <= 0) return 0;
  if (v >= BULB) return 1;
  let i = 1;
  while (volume[i] < v) i++;
  return (i - 1 + (v - volume[i - 1]) / (volume[i] - volume[i - 1])) / STEPS;
}

export type Sand = {
  /** The top sand's surface, and how deep the funnel over the neck has sunk. Null once it's all through. */
  top: { y: number; dip: number } | null;
  /** The pile in the bottom bulb: the level at the walls and its peak. Null before any has fallen. */
  bottom: { y: number; peak: number } | null;
};

/** Where the sand sits with `share` of the time left. */
export function sandAt(share: number): Sand {
  const left = Math.min(Math.max(share, 0), 1);
  const full = FILL * BULB;
  // the top holds what's left, settled down at the neck
  const topT = reach(BULB - left * full);
  const topY = GLASS.top + topT * HALF;
  // the funnel opens up as the sand starts running, never deeper than the sand itself
  const dip = Math.min(7, (1 - left) * 40, (GLASS.neck - topY) * 0.6);
  // the bottom fills from the floor, heaped in the middle where the stream lands
  const fallen = 1 - left;
  const bottomY = GLASS.bottom - reach(fallen * full) * HALF;
  const heap = Math.min(12, fallen * 48, (bottomY - GLASS.neck) * 0.5);
  return {
    top: left > 0.002 ? { y: topY, dip } : null,
    bottom: fallen > 0.002 ? { y: Math.min(bottomY + heap * 0.35, GLASS.bottom), peak: bottomY - heap * 0.65 } : null,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** One side of a bulb as points, cap to neck. `side` is -1 for left, 1 for right; `dir` 1 for the top bulb, -1 for the bottom. */
function wall(side: 1 | -1, dir: 1 | -1, from = 0, to = 1, inset = 1) {
  const pts: string[] = [];
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n;
    const x = GLASS.centre + side * halfWidth(t) * inset;
    const y = dir === 1 ? GLASS.top + t * HALF : GLASS.bottom - t * HALF;
    pts.push(`${round(x)} ${round(y)}`);
  }
  return pts;
}

/** The inside of one bulb, closed, for clipping the sand. */
export function bulbPath(dir: 1 | -1) {
  const right = wall(1, dir);
  const left = wall(-1, dir).reverse();
  return `M${right.join(" L")} L${left.join(" L")} Z`;
}

/** The whole glass outline: both walls, top cap to bottom cap. */
export function glassPath() {
  const side = (s: 1 | -1) => [...wall(s, 1), ...wall(s, -1).reverse().slice(1)];
  return `M${side(-1).join(" L")} M${side(1).join(" L")}`;
}

/** A glint along the inside of a wall, for the light catching the curve. */
export function glintPath(dir: 1 | -1, side: 1 | -1, from: number, to: number, inset: number) {
  return `M${wall(side, dir, from, to, inset).join(" L")}`;
}

/** The top sand: a flat bed whose middle sinks into a funnel. Drawn wide; the bulb clips it. */
export function topSandPath({ y, dip }: { y: number; dip: number }) {
  const c = GLASS.centre;
  return `M0 ${round(y)} H${c - 30} C${c - 12} ${round(y)} ${c - 4} ${round(y + dip)} ${c} ${round(y + dip)} C${c + 4} ${round(y + dip)} ${c + 12} ${round(y)} ${c + 30} ${round(y)} H120 V${GLASS.neck + 4} H0 Z`;
}

/** The bottom sand: a cone heaped under the stream. Drawn wide; the bulb clips it. */
export function bottomSandPath({ y, peak }: { y: number; peak: number }) {
  const c = GLASS.centre;
  return `M0 ${round(y)} H${c - 38} C${c - 16} ${round(y)} ${c - 6} ${round(peak)} ${c} ${round(peak)} C${c + 6} ${round(peak)} ${c + 16} ${round(y)} ${c + 38} ${round(y)} H120 V${GLASS.bottom + 2} H0 Z`;
}
