import Image from "next/image";
import type { DrawnScene, Scene } from "@/lib/scenes";

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
    <svg viewBox="0 0 560 460" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
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

/** The timer card. Darkened most at the top and bottom, and enough through the middle to keep white text readable on any photo. */
export function FocusScene({ scene, children }: { scene: Scene; children: React.ReactNode }) {
  return (
    <div className="relative isolate w-full overflow-hidden rounded-2xl border border-border bg-black text-white">
      {scene.kind === "image" ? (
        <Image
          key={scene.id}
          src={scene.image}
          alt=""
          fill
          priority
          sizes="(min-width: 640px) 560px, 100vw"
          className="-z-20 object-cover"
        />
      ) : (
        <div className="absolute inset-0 -z-20">
          <DrawnBackdrop scene={scene} />
        </div>
      )}
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/65 via-black/35 to-black/70" aria-hidden />
      <div className="[text-shadow:0_1px_3px_rgb(0_0_0/0.7)]">{children}</div>
    </div>
  );
}
