import { brand } from "./brand";

/** Every step of the splash, in milliseconds. Scale them all at once with `speed`: 2 is twice as fast. */
const speed = 1;
const ms = (n: number) => Math.round(n / speed);

export const SPLASH = {
  draw: ms(400), // the ring traces round and the ticks fade in
  sweep: ms(500), // the hand makes one fast turn
  form: ms(300), // the ring becomes the tile and the shackle lifts
  snap: ms(150), // the shackle drops and bounces
  word: ms(120), // the wordmark slides in
  hold: ms(0), // a pause on the finished logo
  fade: ms(130), // the splash fades to the page
  loop: 1600, // one gentle turn while the page isn't ready
  cap: 3000, // the longest it can ever last
  still: 300, // how long the logo shows with reduced motion
};

/** The bounce happens partway through the drop, which is when the click lands. */
export const SNAP_IMPACT = 0.6;

export const SPLASH_TOTAL = SPLASH.draw + SPLASH.sweep + SPLASH.form + SPLASH.snap + SPLASH.word + SPLASH.hold + SPLASH.fade;

const SEEN_KEY = "lockin-splash";

/** Runs before anything paints, so it has to stand alone. If this fails or storage is blocked, the page just shows. */
export const splashScript = `(function(){try{var d=document.documentElement,s=sessionStorage;if(s.getItem("${SEEN_KEY}"))return;s.setItem("${SEEN_KEY}","1");d.dataset.splash="play";var still=matchMedia("(prefers-reduced-motion: reduce)").matches;if(still)d.dataset.splashPhase="end";var out=still?${SPLASH.still}:${SPLASH.cap - SPLASH.fade};setTimeout(function(){if(d.dataset.splash==="play")d.dataset.splash="reveal"},out);setTimeout(function(){delete d.dataset.splash;delete d.dataset.splashPhase},out+${SPLASH.fade})}catch(e){}})()`;

/** In the HTML itself, so the page is dark from the first byte, before the stylesheet arrives. */
export const splashStyle = `html{background:${brand.background};color-scheme:dark}html[data-splash="play"] body>:not(.splash){opacity:0}`;
