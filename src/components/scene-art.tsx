import Image from "next/image";
import "./scene-art.css";
import type { ArtName, ArtScene, DrawnScene, Scene } from "@/lib/scenes";

/*
 * Every background, drawn: the photos, the ridge themes, the illustrated moods, and rain over any of them.
 * Illustrations share one 560×460 canvas and are cropped to fill, like a cover photo.
 */

const VIEW = "0 0 560 460";

/** A tiny seeded random, so the skyline and the books come out the same on the server and the client. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const STARS = [
  [40, 38],
  [96, 82],
  [150, 30],
  [214, 64],
  [268, 24],
  [330, 74],
  [392, 36],
  [452, 88],
  [510, 44],
  [70, 130],
  [486, 138],
];

export function DrawnBackdrop({ scene }: { scene: DrawnScene }) {
  const [far, middle, near] = scene.ridges;
  const gradient = `sky-${scene.id}`;
  return (
    <svg viewBox={VIEW} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={scene.sky[0]} />
          <stop offset="1" stopColor={scene.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="560" height="460" fill={`url(#${gradient})`} />
      {scene.stars && STARS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="#fff" opacity="0.7" />)}
      <circle cx="128" cy="112" r="24" fill={scene.glow} opacity="0.85" />
      <path d="M0 330 L90 262 L170 312 L270 232 L370 310 L460 256 L560 318 V460 H0Z" fill={far} />
      <path d="M0 380 L110 316 L220 378 L330 310 L450 384 L560 336 V460 H0Z" fill={middle} />
      <path d="M0 430 L140 368 L280 428 L420 374 L560 426 V460 H0Z" fill={near} />
    </svg>
  );
}

/* ---- Rain: a grey day over misty hills ---- */
function RainArt() {
  return (
    <>
      <defs>
        <linearGradient id="art-rain-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2530" />
          <stop offset="0.7" stopColor="#4d5868" />
          <stop offset="1" stopColor="#5b6676" />
        </linearGradient>
        <linearGradient id="art-rain-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8d4e2" stopOpacity="0" />
          <stop offset="1" stopColor="#c8d4e2" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <rect width="560" height="460" fill="url(#art-rain-sky)" />
      {[
        [60, 70, 120, 34],
        [210, 50, 150, 40],
        [390, 78, 140, 36],
        [500, 40, 110, 32],
        [140, 120, 160, 30],
        [340, 135, 170, 28],
      ].map(([cx, cy, rx, ry], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#2a313d" opacity={0.75 - i * 0.06} />
      ))}
      <path d="M0 300 C80 270 150 290 220 268 C300 244 380 280 460 258 C510 246 540 252 560 256 V460 H0Z" fill="#3a4351" />
      <rect y="250" width="560" height="110" fill="url(#art-rain-mist)" />
      <path d="M0 350 C90 320 170 344 260 322 C350 300 430 336 560 312 V460 H0Z" fill="#2a313d" />
      <path d="M0 400 C120 378 220 398 320 384 C420 370 490 392 560 380 V460 H0Z" fill="#1b2029" />
      {/* puddles catching the light */}
      <ellipse cx="170" cy="428" rx="70" ry="7" fill="#8fa3bb" opacity="0.22" />
      <ellipse cx="410" cy="440" rx="54" ry="5" fill="#8fa3bb" opacity="0.18" />
    </>
  );
}

/* ---- Beach: the sun going down into the sea ---- */
function BeachArt() {
  return (
    <>
      <defs>
        <linearGradient id="art-beach-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f1a3d" />
          <stop offset="0.5" stopColor="#7b4a7a" />
          <stop offset="1" stopColor="#f29b72" />
        </linearGradient>
        <linearGradient id="art-beach-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4a80" />
          <stop offset="1" stopColor="#1f2147" />
        </linearGradient>
        <linearGradient id="art-beach-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b88a68" />
          <stop offset="1" stopColor="#6e4c3a" />
        </linearGradient>
        <radialGradient id="art-beach-glow">
          <stop offset="0" stopColor="#ffd39a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd39a" stopOpacity="0" />
        </radialGradient>
        <clipPath id="art-beach-above">
          <rect width="560" height="300" />
        </clipPath>
      </defs>
      <rect width="560" height="460" fill="url(#art-beach-sky)" />
      {STARS.slice(0, 6).map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="#fff" opacity="0.55" />
      ))}
      <circle cx="300" cy="290" r="150" fill="url(#art-beach-glow)" />
      <circle cx="300" cy="300" r="56" fill="#ffd39a" clipPath="url(#art-beach-above)" />
      <rect y="300" width="560" height="100" fill="url(#art-beach-sea)" />
      {/* the sun's path on the water */}
      {[
        [306, 64],
        [314, 52],
        [320, 76],
        [330, 44],
        [342, 60],
        [356, 36],
        [372, 50],
      ].map(([y, w], i) => (
        <rect key={i} x={300 - w / 2 + (i % 2 ? 6 : -6)} y={y} width={w} height="3" rx="1.5" fill="#ffd39a" opacity={0.7 - i * 0.07} />
      ))}
      <path d="M0 392 C120 378 250 400 380 386 C460 378 520 384 560 380 V460 H0Z" fill="url(#art-beach-sand)" />
      <path
        d="M0 392 C120 378 250 400 380 386 C460 378 520 384 560 380"
        stroke="#f3e6d6"
        strokeOpacity="0.35"
        strokeWidth="3"
        fill="none"
      />
      {/* a palm leaning in from the left */}
      <g fill="#1a1222">
        <path d="M70 460 C78 400 96 330 128 268" stroke="#1a1222" strokeWidth="11" fill="none" strokeLinecap="round" />
        <path d="M128 268 C100 250 64 254 34 276 C70 262 100 264 126 274Z" />
        <path d="M128 268 C120 236 92 216 60 214 C94 226 112 244 124 270Z" />
        <path d="M128 268 C146 236 176 224 212 226 C178 236 152 252 132 272Z" />
        <path d="M128 268 C162 262 196 276 216 304 C188 284 160 276 130 274Z" />
        <path d="M128 268 C136 240 132 210 118 190 C140 214 142 244 132 270Z" />
      </g>
    </>
  );
}

/* ---- City: a skyline at night, a few windows still lit ---- */
type Tower = { x: number; w: number; h: number; lights: [number, number, number][] };

function towers(seed: number, minH: number, maxH: number, lit: number): Tower[] {
  const rnd = seeded(seed);
  const out: Tower[] = [];
  for (let x = -10; x < 570;) {
    const w = 34 + Math.floor(rnd() * 36);
    const h = minH + Math.floor(rnd() * (maxH - minH));
    const lights: [number, number, number][] = [];
    for (let wy = 460 - h + 14; wy < 446; wy += 16) {
      for (let wx = x + 7; wx < x + w - 9; wx += 11) {
        if (rnd() < lit) lights.push([wx, wy, 0.35 + rnd() * 0.6]);
      }
    }
    out.push({ x, w, h, lights });
    x += w + 2 + Math.floor(rnd() * 6);
  }
  return out;
}

const FAR_TOWERS = towers(7, 150, 260, 0);
const NEAR_TOWERS = towers(19, 110, 300, 0.32);

function CityArt() {
  return (
    <>
      <defs>
        <linearGradient id="art-city-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1026" />
          <stop offset="0.75" stopColor="#3a2a5c" />
          <stop offset="1" stopColor="#6a3f6a" />
        </linearGradient>
        <radialGradient id="art-city-moon">
          <stop offset="0" stopColor="#f3e9d2" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f3e9d2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="560" height="460" fill="url(#art-city-sky)" />
      {STARS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="#fff" opacity="0.6" />
      ))}
      <circle cx="432" cy="92" r="70" fill="url(#art-city-moon)" />
      <circle cx="432" cy="92" r="22" fill="#f3e9d2" />
      {FAR_TOWERS.map((t, i) => (
        <rect key={i} x={t.x} y={460 - t.h} width={t.w} height={t.h} fill="#262448" />
      ))}
      {NEAR_TOWERS.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={460 - t.h + 40} width={t.w} height={t.h} fill="#13132a" />
          {t.lights.map(([x, y, o], j) => (
            <rect key={j} x={x} y={y + 40} width="5" height="7" rx="1" fill="#ffd27a" opacity={o} />
          ))}
        </g>
      ))}
    </>
  );
}

/* ---- Library: tall shelves and a desk lamp ---- */
const BOOK_COLOURS = ["#7a2e2e", "#2e4a6b", "#6b5a2e", "#3d5c3a", "#5a3d6b", "#8a5a3a", "#c9b48a", "#4a2a2a"];

function shelves() {
  const rnd = seeded(42);
  const rows: { y: number; books: { x: number; w: number; h: number; c: string; tilt: number }[] }[] = [];
  for (const y of [100, 190, 280]) {
    const books = [];
    for (let x = 6; x < 552;) {
      const w = 10 + Math.floor(rnd() * 13);
      const h = 52 + Math.floor(rnd() * 22);
      const gap = rnd() < 0.08 ? 18 : 1;
      books.push({ x, w, h, c: BOOK_COLOURS[Math.floor(rnd() * BOOK_COLOURS.length)], tilt: gap > 1 ? 8 : 0 });
      x += w + gap;
    }
    rows.push({ y, books });
  }
  return rows;
}

const SHELVES = shelves();

function LibraryArt() {
  return (
    <>
      <defs>
        <linearGradient id="art-lib-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e140e" />
          <stop offset="1" stopColor="#2e1f15" />
        </linearGradient>
        <radialGradient id="art-lib-lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffc46b" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffc46b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="560" height="460" fill="url(#art-lib-wall)" />
      {SHELVES.map((row) => (
        <g key={row.y}>
          {row.books.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={row.y - b.h}
              width={b.w}
              height={b.h}
              rx="1.5"
              fill={b.c}
              opacity="0.85"
              transform={b.tilt ? `rotate(${b.tilt} ${b.x} ${row.y})` : undefined}
            />
          ))}
          <rect x="0" y={row.y} width="560" height="9" fill="#4a3020" />
          <rect x="0" y={row.y + 9} width="560" height="3" fill="#120c08" opacity="0.6" />
        </g>
      ))}
      <circle cx="420" cy="330" r="190" fill="url(#art-lib-lamp)" />
      {/* the desk, a book open on it, and the lamp */}
      <rect y="372" width="560" height="88" fill="#1a110c" />
      <rect y="364" width="560" height="12" fill="#3b2618" />
      <path d="M200 362 L250 352 L300 362 L250 358Z" fill="#e9dcc2" />
      <path d="M200 362 L250 352 L250 358Z" fill="#d8c8a8" />
      <rect x="404" y="356" width="34" height="8" rx="3" fill="#2a1a10" />
      <rect x="418" y="300" width="5" height="58" fill="#2a1a10" />
      <path d="M392 302 L450 302 L436 268 L406 268Z" fill="#e0a050" />
      <rect y="0" width="560" height="460" fill="#000" opacity="0.12" />
    </>
  );
}

/* ---- Window view: dusk outside, a plant on the sill ---- */
function WindowArt() {
  return (
    <>
      <defs>
        <linearGradient id="art-win-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b3d6b" />
          <stop offset="0.65" stopColor="#b8789a" />
          <stop offset="1" stopColor="#e8a07a" />
        </linearGradient>
        <linearGradient id="art-win-wall" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#15131c" />
          <stop offset="0.5" stopColor="#221f2c" />
          <stop offset="1" stopColor="#15131c" />
        </linearGradient>
        <clipPath id="art-win-glass">
          <rect x="130" y="70" width="300" height="280" />
        </clipPath>
      </defs>
      <rect width="560" height="460" fill="url(#art-win-wall)" />
      <g clipPath="url(#art-win-glass)">
        <rect x="130" y="70" width="300" height="280" fill="url(#art-win-sky)" />
        <circle cx="350" cy="250" r="26" fill="#ffd2a0" opacity="0.9" />
        <path d="M130 300 L180 270 L230 292 L290 258 L350 290 L410 266 L430 276 V350 H130Z" fill="#5a4a6e" />
        {FAR_TOWERS.slice(3, 11).map((t, i) => (
          <rect key={i} x={130 + i * 38} y={350 - t.h * 0.28} width={30} height={t.h * 0.28} fill="#3a3050" />
        ))}
      </g>
      {/* frame, mullions and sill */}
      <rect x="122" y="62" width="316" height="296" fill="none" stroke="#3a3446" strokeWidth="16" />
      <rect x="276" y="70" width="8" height="280" fill="#3a3446" />
      <rect x="130" y="206" width="300" height="8" fill="#3a3446" />
      <rect x="100" y="356" width="360" height="18" rx="3" fill="#4a4258" />
      <rect y="374" width="560" height="86" fill="#100e15" />
      {/* a plant in a pot */}
      <path d="M372 356 L378 326 L406 326 L412 356Z" fill="#b8664a" />
      {[
        [392, 300, 10, 28, -20],
        [380, 306, 9, 24, -50],
        [404, 306, 9, 24, 40],
        [372, 316, 8, 18, -70],
        [412, 316, 8, 18, 65],
      ].map(([cx, cy, rx, ry, r], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={i % 2 ? "#4f7a52" : "#5f9162"} transform={`rotate(${r} ${cx} ${cy + ry})`} />
      ))}
      {/* curtains */}
      <path d="M60 40 C90 140 70 260 96 380 L40 380 C30 260 44 140 30 40Z" fill="#3d2f4a" />
      <path d="M500 40 C470 140 490 260 464 380 L520 380 C530 260 516 140 530 40Z" fill="#3d2f4a" />
      <rect x="20" y="30" width="520" height="10" rx="5" fill="#2a2433" />
    </>
  );
}

const ART: Record<ArtName, () => React.ReactElement> = {
  rain: RainArt,
  beach: BeachArt,
  city: CityArt,
  library: LibraryArt,
  window: WindowArt,
};

export function ArtBackdrop({ scene }: { scene: ArtScene }) {
  const Art = ART[scene.art];
  return (
    <svg viewBox={VIEW} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
      <Art />
    </svg>
  );
}

/* ---- Rain over anything ---- */

/** One tile of slanted streaks. Tiles repeat, and the layer slides down by exactly one tile to loop. */
function streaks(seed: number, size: number, count: number, length: number, width: number, opacity: number) {
  const rnd = seeded(seed);
  let lines = "";
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * (size - length);
    const l = length * (0.6 + rnd() * 0.4);
    lines += `<line x1='${x.toFixed(1)}' y1='${y.toFixed(1)}' x2='${(x - l * 0.12).toFixed(1)}' y2='${(y + l).toFixed(1)}' stroke='white' stroke-opacity='${(opacity * (0.5 + rnd() * 0.5)).toFixed(2)}' stroke-width='${width}' stroke-linecap='round'/>`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>${lines}</svg>`)}")`;
}

/** Drops sitting on glass, for the window. */
function drops(seed: number, size: number, count: number) {
  const rnd = seeded(seed);
  let dots = "";
  for (let i = 0; i < count; i++) {
    const r = 1 + rnd() * 2.6;
    dots += `<ellipse cx='${(rnd() * size).toFixed(1)}' cy='${(rnd() * size).toFixed(1)}' rx='${r.toFixed(1)}' ry='${(r * 1.25).toFixed(1)}' fill='white' fill-opacity='${(0.12 + rnd() * 0.22).toFixed(2)}'/>`;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>${dots}</svg>`)}")`;
}

const FAR_RAIN = { size: 180, image: streaks(3, 180, 42, 16, 1, 0.38) };
const NEAR_RAIN = { size: 260, image: streaks(11, 260, 22, 34, 1.6, 0.55) };
const GLASS = drops(23, 220, 26);

const layer = (r: { size: number; image: string }, seconds: number) =>
  ({ backgroundImage: r.image, "--tile": `${r.size}px`, animationDuration: `${seconds}s` }) as React.CSSProperties;

/** Animated rain. `still` freezes it, for thumbnails. The window gets drops on the glass too. */
export function RainLayer({ glass = false, still = false }: { glass?: boolean; still?: boolean }) {
  return (
    <div className="scene-rain" data-still={still || undefined} aria-hidden>
      <span className="scene-rain-layer" style={layer(FAR_RAIN, 0.9)} />
      <span className="scene-rain-layer" style={layer(NEAR_RAIN, 0.55)} />
      {glass && <span className="scene-rain-glass" style={{ backgroundImage: GLASS }} />}
    </div>
  );
}

/**
 * Any scene, filling its parent. `thumb` uses the small photo and holds the rain still.
 * `sizes` and `priority` pass through to the photo.
 */
export function SceneBackdrop({
  scene,
  sizes = "100vw",
  priority = false,
  thumb = false,
}: {
  scene: Scene;
  sizes?: string;
  priority?: boolean;
  thumb?: boolean;
}) {
  return (
    <>
      {scene.kind === "image" ? (
        <Image
          key={scene.id}
          src={thumb ? scene.thumb : scene.image}
          alt=""
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      ) : scene.kind === "drawn" ? (
        <DrawnBackdrop scene={scene} />
      ) : (
        <ArtBackdrop scene={scene} />
      )}
      {scene.rain && <RainLayer glass={scene.kind === "art" && scene.art === "window"} still={thumb} />}
    </>
  );
}
