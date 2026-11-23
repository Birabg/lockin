/**
 * Background sound for the focus screens. The instruments and nature sounds are made in the browser
 * with Web Audio: nothing to download, nothing to license, and they work offline. A pasted YouTube
 * link plays in YouTube's own player instead (see music-panel.tsx), and the focus track is an audio
 * file that only starts when a session locks in. One thing plays at a time.
 */
import { PIECES, pieceBeat, type Lead, type Piece, type PieceId } from "./music-pieces";
import { cleanYouTube, type YouTubeLink } from "./youtube";

export const AMBIENCES = [
  { id: "lofi", kind: "music", title: "Lo-fi keys", hint: "Slow chords, soft beat" },
  { id: "piano", kind: "music", title: "Piano", hint: "Quiet piano, gentle chords" },
  { id: "violin", kind: "music", title: "Violin", hint: "Violin over warm strings" },
  { id: "cello", kind: "music", title: "Cello", hint: "Deep and slow" },
  { id: "sax", kind: "music", title: "Saxophone", hint: "Late-night jazz, brushes" },
  { id: "guitar", kind: "music", title: "Acoustic guitar", hint: "Picked chords" },
  { id: "flute", kind: "music", title: "Flute & harp", hint: "Airy and light" },
  { id: "musicbox", kind: "music", title: "Music box", hint: "Little bells" },
  { id: "rain", kind: "nature", title: "Rain", hint: "Steady rain on glass" },
  { id: "waves", kind: "nature", title: "Ocean waves", hint: "Waves rolling in" },
  { id: "brown", kind: "nature", title: "Brown noise", hint: "A deep, even hum" },
] as const;

export type AmbienceId = (typeof AMBIENCES)[number]["id"];
export const isAmbienceId = (v: unknown): v is AmbienceId => AMBIENCES.some((a) => a.id === v);

/** A generated sound, the YouTube link, or the focus track. */
export type Choice = AmbienceId | "youtube" | "track";

/** The recording that plays from lock-in by default. It loops, and starts only when a session begins. */
export const FOCUS_TRACK = { src: "/audio/rainy-piano.m4a", title: "Rainy piano", by: "Gibran Alcocer" } as const;

export type AmbiencePrefs = { sound: Choice | null; volume: number; youtube: YouTubeLink | null };
/** Someone who has never chosen gets the focus track; picking Off is what turns it off. */
export const DEFAULT_PREFS: AmbiencePrefs = { sound: "track", volume: 0.6, youtube: null };

export const clampVolume = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_PREFS.volume;

/** What was saved last time, ignoring anything broken or from an older version. */
export function parsePrefs(raw: string | null): AmbiencePrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const v = JSON.parse(raw) as Partial<AmbiencePrefs> | null;
    if (!v || typeof v !== "object") return DEFAULT_PREFS;
    const youtube = cleanYouTube(v?.youtube);
    const sound = isAmbienceId(v?.sound) || v?.sound === "track" ? v.sound : v?.sound === "youtube" && youtube ? "youtube" : null;
    return { sound, volume: clampVolume(v?.volume), youtube };
  } catch {
    return DEFAULT_PREFS;
  }
}

/* ---- The lo-fi loop, as plain data so it can be tested ---- */

/** A MIDI note number to hertz, with A4 (69) at 440. */
export const midiHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

export const LOFI_BPM = 72;

/** One chord per bar: Dmaj9, Bm11, Gmaj9, A13sus. Close voicings so the pad stays soft. */
export const LOFI_CHORDS: readonly (readonly number[])[] = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 62, 64],
  [43, 50, 54, 57, 62],
  [45, 52, 55, 62, 66],
];

/** D major pentatonic, so any note fits any of the chords. */
export const LOFI_SCALE = [62, 64, 66, 69, 71, 74, 76, 78] as const;

export type Beat = {
  /** The notes of a new chord, on the first beat of each bar. */
  chord: readonly number[] | null;
  kick: boolean;
  snare: boolean;
  /** A key to play on this beat, or null for a rest. */
  note: number | null;
};

/** What plays on beat number `beat`. `rand` is Math.random in the player and fixed in tests. */
export function lofiBeat(beat: number, rand: () => number): Beat {
  const inBar = beat % 4;
  const bar = Math.floor(beat / 4);
  return {
    chord: inBar === 0 ? LOFI_CHORDS[bar % LOFI_CHORDS.length] : null,
    kick: inBar === 0 || inBar === 2,
    snare: inBar === 1 || inBar === 3,
    note: rand() < 0.45 ? LOFI_SCALE[Math.floor(rand() * LOFI_SCALE.length) % LOFI_SCALE.length] : null,
  };
}

/* ---- The player (browser only) ---- */

const PREFS_KEY = "lockin-ambience";
const FADE_IN = 1.5;
const FADE_OUT = 0.8;
const LOOKAHEAD = 1.5; // seconds scheduled ahead; background tabs only get a timer tick about once a second
const TICK_MS = 250;

type Playing = { id: AmbienceId; out: GainNode; stop: () => void };
/** `paused` is the focus track held mid-play, by its pause button or by the session pausing. */
export type AmbienceState = AmbiencePrefs & { playing: boolean; paused: boolean };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: Playing | null = null;
const buffers: Partial<Record<"white" | "pink" | "brown" | "crackle", AudioBuffer>> = {};
let state: AmbienceState = { ...DEFAULT_PREFS, playing: false, paused: false };
let loaded = false;
const listeners = new Set<() => void>();

function set(next: Partial<AmbienceState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function subscribeAmbience(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getAmbience = () => state;
const SERVER_STATE: AmbienceState = { ...DEFAULT_PREFS, playing: false, paused: false };
export const getServerAmbience = () => SERVER_STATE;

/** Reads the saved choice once. Nothing plays until someone presses something. */
export function loadAmbience() {
  if (loaded) return state;
  loaded = true;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFS_KEY);
  } catch {
    // private windows can refuse storage; it only means nothing is remembered
  }
  set(parsePrefs(raw));
  return state;
}

function save() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ sound: state.sound, volume: state.volume, youtube: state.youtube }));
  } catch {
    // only means it won't be remembered next time
  }
}

/** Volume on a curve, so the low half of the slider isn't all nearly silent. */
const loudness = (v: number) => v * v * 0.9;

function audio() {
  if (!ctx && typeof AudioContext !== "undefined") {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = loudness(state.volume);
    master.connect(ctx.destination);
  }
  return ctx;
}

function noise(c: AudioContext, kind: "white" | "pink" | "brown" | "crackle"): AudioBuffer {
  const cached = buffers[kind];
  if (cached) return cached;
  const length = c.sampleRate * 6;
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "white") data[i] = white;
    else if (kind === "pink") {
      // Paul Kellet's cheap pink filter
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    } else if (kind === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      // sparse clicks of random size: vinyl dust, or drops on a window
      data[i] = Math.random() < 0.0009 ? white * (0.3 + Math.random() * 0.7) : 0;
    }
  }
  buffers[kind] = buffer;
  return buffer;
}

function loop(c: AudioContext, kind: "white" | "pink" | "brown" | "crackle", to: AudioNode, offset = 0) {
  const src = c.createBufferSource();
  src.buffer = noise(c, kind);
  src.loop = true;
  src.connect(to);
  src.start(c.currentTime, offset);
  return src;
}

function filter(c: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

function gain(c: AudioContext, value: number) {
  const g = c.createGain();
  g.gain.value = value;
  return g;
}

/** A slow wobble added to `param`, between value - depth and value + depth. */
function lfo(c: AudioContext, rate: number, depth: number, param: AudioParam) {
  const osc = c.createOscillator();
  osc.frequency.value = rate;
  const amount = gain(c, depth);
  osc.connect(amount).connect(param);
  osc.start();
  return osc;
}

type Built = { stop: () => void };

function buildBrown(c: AudioContext, out: GainNode): Built {
  const lp = filter(c, "lowpass", 600);
  lp.connect(gain(c, 0.9)).connect(out);
  const src = loop(c, "brown", lp);
  return { stop: () => src.stop() };
}

function buildRain(c: AudioContext, out: GainNode): Built {
  const hiss = filter(c, "highpass", 500);
  const air = filter(c, "lowpass", 7000);
  hiss.connect(air).connect(gain(c, 0.32)).connect(out);
  const body = filter(c, "lowpass", 250);
  body.connect(gain(c, 0.35)).connect(out);
  const drops = filter(c, "bandpass", 2800, 1.2);
  drops.connect(gain(c, 0.5)).connect(out);
  const sources = [loop(c, "pink", hiss), loop(c, "brown", body), loop(c, "crackle", drops), loop(c, "crackle", drops, 3.1)];
  const swell = lfo(c, 0.05, 0.06, out.gain); // rain gets a little heavier and lighter
  return { stop: () => [...sources, swell].forEach((s) => s.stop()) };
}

function buildWaves(c: AudioContext, out: GainNode): Built {
  const lp = filter(c, "lowpass", 700);
  const level = gain(c, 0.45);
  const src = loop(c, "pink", lp);
  lp.connect(level).connect(out);
  // two slow wobbles at different rates, so the waves don't arrive like a metronome
  const wobbles = [
    lfo(c, 0.09, 420, lp.frequency),
    lfo(c, 0.057, 200, lp.frequency),
    lfo(c, 0.09, 0.3, level.gain),
    lfo(c, 0.057, 0.12, level.gain),
  ];
  const under = filter(c, "lowpass", 160);
  const rumble = loop(c, "brown", under);
  under.connect(gain(c, 0.25)).connect(out);
  return { stop: () => [src, rumble, ...wobbles].forEach((s) => s.stop()) };
}

function buildLofi(c: AudioContext, out: GainNode): Built {
  const warm = filter(c, "lowpass", 2600);
  warm.connect(out);
  const dust = filter(c, "highpass", 1200);
  dust.connect(gain(c, 0.12)).connect(out);
  const hiss = filter(c, "bandpass", 5000, 0.4);
  hiss.connect(gain(c, 0.012)).connect(out);
  const bed = [loop(c, "crackle", dust), loop(c, "white", hiss)];

  const beatLength = 60 / LOFI_BPM;
  const swing = beatLength * 0.08;
  let beat = 0;
  let next = c.currentTime + 0.1;

  function tone(type: OscillatorType, hz: number, at: number, peak: number, attack: number, hold: number, release: number, detune = 0) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = hz;
    osc.detune.value = detune;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(peak, at + attack);
    env.gain.setValueAtTime(peak, at + attack + hold);
    env.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
    osc.connect(env).connect(warm);
    osc.start(at);
    osc.stop(at + attack + hold + release + 0.05);
  }

  function hit(kind: "white" | "pink", at: number, f: BiquadFilterNode, peak: number, decay: number) {
    const src = c.createBufferSource();
    src.buffer = noise(c, kind);
    const env = c.createGain();
    env.gain.setValueAtTime(peak, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(f).connect(env).connect(warm);
    src.start(at, Math.random() * 4, decay + 0.05);
  }

  function kick(at: number) {
    const osc = c.createOscillator();
    osc.frequency.setValueAtTime(110, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    const env = c.createGain();
    env.gain.setValueAtTime(0.42, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    osc.connect(env).connect(warm);
    osc.start(at);
    osc.stop(at + 0.35);
  }

  function schedule(n: number, at: number) {
    const b = lofiBeat(n, Math.random);
    if (b.chord) {
      const bar = beatLength * 4;
      for (const note of b.chord) for (const detune of [-7, 7]) tone("triangle", midiHz(note), at, 0.018, 0.9, bar - 1.2, 1.4, detune);
      tone("sine", midiHz(b.chord[0] - 12), at, 0.09, 0.05, bar - 0.6, 0.5); // bass
    }
    if (b.kick) kick(at);
    if (b.snare) hit("pink", at, filter(c, "bandpass", 1800, 0.8), 0.07, 0.16);
    for (const off of [0, beatLength / 2 + swing]) hit("white", at + off, filter(c, "highpass", 7500), off ? 0.03 : 0.018, 0.05);
    if (b.note !== null) {
      const when = at + (Math.random() < 0.3 ? beatLength / 2 + swing : 0);
      tone("sine", midiHz(b.note), when, 0.07, 0.01, 0.05, 1.3);
      tone("triangle", midiHz(b.note + 12), when, 0.012, 0.01, 0.02, 0.6);
    }
  }

  function tick() {
    // after a long sleep (a laptop lid), start again from now rather than catching up
    if (next < c.currentTime - 1) next = c.currentTime + 0.1;
    while (next < c.currentTime + LOOKAHEAD) {
      schedule(beat++, next);
      next += beatLength;
    }
  }
  tick();
  const timer = setInterval(tick, TICK_MS);
  return {
    stop: () => {
      clearInterval(timer);
      bed.forEach((s) => s.stop());
    },
  };
}

/* ---- Instruments, all synthesized ---- */

/** A plucked string (Karplus-Strong), worked out once per note and kept. */
const plucks = new Map<string, AudioBuffer>();
function pluck(c: AudioContext, hz: number, damping: number): AudioBuffer {
  const key = `${hz.toFixed(2)}:${damping}`;
  const cached = plucks.get(key);
  if (cached) return cached;
  const length = Math.floor(c.sampleRate * 2.5);
  const period = Math.max(2, Math.round(c.sampleRate / hz));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const y = buffer.getChannelData(0);
  for (let i = 0; i < period; i++) y[i] = Math.random() * 2 - 1;
  // each pass averages neighbouring samples, so high harmonics die first, like a real string
  for (let i = period; i < length; i++) y[i] = damping * 0.5 * (y[i - period] + y[Math.max(0, i - period - 1)]);
  plucks.set(key, buffer);
  return buffer;
}

type Env = { attack: number; peak: number; hold: number; release: number };

function envelope(c: AudioContext, at: number, e: Env) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(e.peak, at + e.attack);
  g.gain.setValueAtTime(e.peak, at + e.attack + e.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + e.attack + e.hold + e.release);
  return { node: g, end: at + e.attack + e.hold + e.release + 0.05 };
}

function osc(c: AudioContext, type: OscillatorType, hz: number, to: AudioNode, at: number, end: number, detune = 0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  o.detune.value = detune;
  o.connect(to);
  o.start(at);
  o.stop(end);
  return o;
}

/** Vibrato that starts after the note has settled, the way players add it. */
function vibrato(c: AudioContext, target: OscillatorNode[], at: number, end: number, rate: number, cents: number) {
  const o = c.createOscillator();
  o.frequency.value = rate;
  const depth = c.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(cents, at + 0.35);
  o.connect(depth);
  for (const t of target) depth.connect(t.detune);
  o.start(at);
  o.stop(end);
}

/** Plays one note of `lead` at `at`, lasting about `seconds`, into `to`. */
function playNote(c: AudioContext, lead: Lead, note: number, at: number, seconds: number, to: AudioNode, soft = 1) {
  const hz = midiHz(note);
  switch (lead) {
    case "piano": {
      // bright when struck, mellowing as it rings: a filter closing over a few harmonics
      const e = envelope(c, at, { attack: 0.005, peak: 0.11 * soft, hold: 0, release: note < 60 ? 3.2 : 2.4 });
      const tone = filter(c, "lowpass", Math.min(hz * 8, 7000));
      tone.frequency.setValueAtTime(Math.min(hz * 8, 7000), at);
      tone.frequency.exponentialRampToValueAtTime(Math.max(hz * 1.5, 300), at + 1.6);
      tone.connect(e.node).connect(to);
      osc(c, "triangle", hz, tone, at, e.end, -3);
      osc(c, "triangle", hz, tone, at, e.end, 3);
      const h = gain(c, 0.25);
      h.connect(tone);
      osc(c, "sine", hz * 2, h, at, e.end);
      return;
    }
    case "violin":
    case "cello": {
      const low = lead === "cello";
      const e = envelope(c, at, {
        attack: low ? 0.3 : 0.22,
        peak: (low ? 0.06 : 0.042) * soft,
        hold: Math.max(0.1, seconds - 0.3),
        release: low ? 0.7 : 0.5,
      });
      const body = filter(c, "lowpass", low ? 1800 : 3400, 1.2);
      const cut = filter(c, "highpass", low ? 60 : 180);
      body.connect(cut).connect(e.node).connect(to);
      const strings = [osc(c, "sawtooth", hz, body, at, e.end, -5), osc(c, "sawtooth", hz, body, at, e.end, 5)];
      vibrato(c, strings, at + 0.2, e.end, low ? 5 : 5.8, low ? 10 : 14);
      return;
    }
    case "sax": {
      const e = envelope(c, at, { attack: 0.05, peak: 0.055 * soft, hold: Math.max(0.05, seconds - 0.2), release: 0.25 });
      const horn = filter(c, "bandpass", 1100, 0.9);
      const top = filter(c, "lowpass", 2800);
      horn.connect(top).connect(e.node).connect(to);
      const reedy = gain(c, 0.3);
      reedy.connect(horn);
      const reeds = [osc(c, "sawtooth", hz, horn, at, e.end), osc(c, "square", hz, reedy, at, e.end)];
      // players scoop up into a note
      for (const r of reeds) {
        r.detune.setValueAtTime(-60, at);
        r.detune.linearRampToValueAtTime(0, at + 0.08);
      }
      vibrato(c, reeds, at + 0.25, e.end, 5, 12);
      const breath = c.createBufferSource();
      breath.buffer = noise(c, "pink");
      const air = filter(c, "bandpass", 2200, 1);
      breath.connect(air).connect(gain(c, 0.25)).connect(e.node);
      breath.start(at, Math.random() * 4, e.end - at);
      return;
    }
    case "flute": {
      const e = envelope(c, at, { attack: 0.12, peak: 0.07 * soft, hold: Math.max(0.05, seconds - 0.2), release: 0.3 });
      e.node.connect(to);
      const pipe = [osc(c, "sine", hz, e.node, at, e.end)];
      const h = gain(c, 0.12);
      h.connect(e.node);
      pipe.push(osc(c, "sine", hz * 2, h, at, e.end));
      vibrato(c, pipe, at + 0.2, e.end, 4.6, 9);
      const breath = c.createBufferSource();
      breath.buffer = noise(c, "white");
      const air = filter(c, "bandpass", Math.min(hz * 2, 6000), 2);
      breath.connect(air).connect(gain(c, 0.12)).connect(e.node);
      breath.start(at, Math.random() * 4, e.end - at);
      return;
    }
    case "guitar":
    case "harp": {
      const src = c.createBufferSource();
      src.buffer = pluck(c, hz, lead === "harp" ? 0.998 : 0.996);
      const tone = filter(c, "lowpass", lead === "harp" ? 5000 : 3200);
      src
        .connect(tone)
        .connect(gain(c, (lead === "harp" ? 0.22 : 0.3) * soft))
        .connect(to);
      src.start(at);
      return;
    }
    case "bells": {
      // a music box tine: the note plus two quick, slightly out-of-tune overtones
      const partials: [number, number, number][] = [
        [1, 0.08, 1.8],
        [2.76, 0.025, 0.6],
        [5.4, 0.012, 0.25],
      ];
      for (const [ratio, peak, decay] of partials) {
        const e = envelope(c, at, { attack: 0.003, peak: peak * soft, hold: 0, release: decay });
        e.node.connect(to);
        osc(c, "sine", hz * ratio, e.node, at, e.end);
      }
      return;
    }
  }
}

function buildPiece(piece: Piece) {
  return (c: AudioContext, out: GainNode): Built => {
    const room = filter(c, "lowpass", 6000);
    room.connect(out);
    // a quiet, short echo standing in for a room
    const echo = c.createDelay(1);
    echo.delayTime.value = 0.23;
    const feedback = gain(c, 0.28);
    const wet = gain(c, 0.18);
    room.connect(echo).connect(feedback).connect(echo);
    echo.connect(wet).connect(out);

    const beatLength = 60 / piece.bpm;
    let beat = 0;
    let prev = -1;
    let next = c.currentTime + 0.1;

    function schedule(n: number, at: number) {
      const b = pieceBeat(piece, n, Math.random, prev);
      const human = () => Math.random() * 0.015; // nobody plays exactly on the grid
      if (b.chord && piece.pad) {
        const bar = beatLength * 4;
        for (const note of b.chord) {
          if (piece.pad === "strings") {
            const e = envelope(c, at, { attack: 1.2, peak: 0.01, hold: bar - 1.4, release: 1.6 });
            const soft = filter(c, "lowpass", 900);
            soft.connect(e.node).connect(room);
            osc(c, "sawtooth", midiHz(note), soft, at, e.end, -8);
            osc(c, "sawtooth", midiHz(note), soft, at, e.end, 8);
          } else {
            const e = envelope(c, at, { attack: 0.02, peak: 0.022, hold: bar * 0.5, release: 1.2 });
            e.node.connect(room);
            osc(c, "sine", midiHz(note), e.node, at, e.end);
            const h = gain(c, 0.2);
            h.connect(e.node);
            osc(c, "sine", midiHz(note) * 2, h, at, e.end);
          }
        }
      }
      if (piece.arp)
        for (const a of b.arp) playNote(c, piece.arp, a.note, at + a.offset * beatLength + human(), beatLength / 2, room, 0.55);
      if (b.lead) {
        prev = b.lead.index;
        playNote(c, piece.lead, b.lead.note, at + human(), piece.noteBeats * beatLength, room);
      }
      if (b.bass !== null) {
        const upright = piece.bass === "upright";
        const e = envelope(
          c,
          at,
          upright ? { attack: 0.01, peak: 0.14, hold: 0, release: 0.7 } : { attack: 0.3, peak: 0.07, hold: beatLength * 3, release: 0.8 },
        );
        const tone = filter(c, "lowpass", upright ? 700 : 400);
        tone.connect(e.node).connect(room);
        osc(c, upright ? "triangle" : "sine", midiHz(b.bass), tone, at, e.end);
      }
      if (b.swish) brush(at, 2800, 0.02, 0.06, 0.28);
      if (b.tap) brush(at, 1600, 0.06, 0.005, 0.12);
    }

    function brush(at: number, hz: number, peak: number, attack: number, decay: number) {
      const src = c.createBufferSource();
      src.buffer = noise(c, "pink");
      const e = envelope(c, at, { attack, peak, hold: 0, release: decay });
      src
        .connect(filter(c, "bandpass", hz, 0.6))
        .connect(e.node)
        .connect(room);
      src.start(at, Math.random() * 4, e.end - at);
    }

    function tick() {
      if (next < c.currentTime - 1) next = c.currentTime + 0.1;
      while (next < c.currentTime + LOOKAHEAD) {
        schedule(beat++, next);
        next += beatLength;
      }
    }
    tick();
    const timer = setInterval(tick, TICK_MS);
    return { stop: () => clearInterval(timer) };
  };
}

const piece = (id: PieceId) => buildPiece(PIECES[id]);

const BUILDERS: Record<AmbienceId, (c: AudioContext, out: GainNode) => Built> = {
  lofi: buildLofi,
  piano: piece("piano"),
  violin: piece("violin"),
  cello: piece("cello"),
  sax: piece("sax"),
  guitar: piece("guitar"),
  flute: piece("flute"),
  musicbox: piece("musicbox"),
  rain: buildRain,
  waves: buildWaves,
  brown: buildBrown,
};

function fadeOut(p: Playing, c: AudioContext) {
  const now = c.currentTime;
  p.out.gain.cancelScheduledValues(now);
  p.out.gain.setValueAtTime(p.out.gain.value, now);
  p.out.gain.linearRampToValueAtTime(0, now + FADE_OUT);
  setTimeout(
    () => {
      p.stop();
      p.out.disconnect();
    },
    FADE_OUT * 1000 + 100,
  );
}

/* ---- The focus track: an audio element, so an hour of music streams instead of loading into memory ---- */

let trackEl: HTMLAudioElement | null = null;
let trackFade: ReturnType<typeof setInterval> | undefined;
/** Bumped on every start and stop, so a fade that finishes late can't undo what came after it. */
let trackTurn = 0;
/** The session paused the track, so the session resuming may start it again. */
let heldBySession = false;
/** A session is on. Outside one, picking the track only chooses it; it waits for the next lock-in. */
let focusing = false;

const trackLevel = () => state.volume * state.volume;

function trackAudio() {
  if (!trackEl && typeof Audio !== "undefined") {
    trackEl = new Audio(FOCUS_TRACK.src);
    trackEl.loop = true;
    trackEl.preload = "auto";
  }
  return trackEl;
}

function fadeTrack(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  clearInterval(trackFade);
  const from = el.volume;
  const began = Date.now();
  trackFade = setInterval(() => {
    const t = Math.min(1, (Date.now() - began) / ms);
    el.volume = Math.min(1, Math.max(0, from + (to - from) * t));
    if (t < 1) return;
    clearInterval(trackFade);
    done?.();
  }, 40);
}

function startTrack() {
  const el = trackAudio();
  if (!el) return;
  if (current && ctx) fadeOut(current, ctx);
  current = null;
  heldBySession = false;
  const turn = ++trackTurn;
  if (el.paused) el.volume = 0;
  set({ playing: true, paused: false });
  el.play()
    .then(() => {
      if (turn === trackTurn) fadeTrack(el, trackLevel(), FADE_IN * 1000);
    })
    .catch(() => {
      if (turn === trackTurn) set({ playing: false });
    });
}

/** Fades the track out and pauses it, keeping its place for next time. */
function quietTrack() {
  const el = trackEl;
  if (!el) return;
  const turn = ++trackTurn;
  fadeTrack(el, 0, FADE_OUT * 1000, () => {
    if (turn === trackTurn) el.pause();
  });
}

function startSound(id: AmbienceId) {
  const c = audio();
  if (!c || !master) return;
  if (current?.id === id) return;
  if (current) fadeOut(current, c);
  quietTrack();
  const out = c.createGain();
  out.gain.setValueAtTime(0, c.currentTime);
  out.gain.linearRampToValueAtTime(1, c.currentTime + FADE_IN);
  out.connect(master);
  const built = BUILDERS[id](c, out);
  current = { id, out, stop: built.stop };
  c.resume()
    .then(() => {
      if (current?.id === id) set({ playing: c.state === "running" });
    })
    .catch(() => set({ playing: false }));
}

/** Stops the generated sound and lets the YouTube player (rendered by the page) take over. */
function startYouTube() {
  quietTrack();
  if (current && ctx) fadeOut(current, ctx);
  current = null;
  set({ playing: true });
}

/** Plays a sound (or nothing, for null) and remembers it. Call it from a press: browsers need one before sound. */
export function playAmbience(id: Choice | null) {
  loadAmbience();
  if (id === "youtube" && !state.youtube) return;
  set({ sound: id });
  save();
  if (id === "youtube") startYouTube();
  else if (id === "track") {
    if (focusing) startTrack();
    else stopAmbience();
  } else if (id) startSound(id);
  else stopAmbience();
}

/** Plays a pasted YouTube video or playlist, and remembers it. */
export function playYouTube(link: YouTubeLink) {
  loadAmbience();
  set({ youtube: link, sound: "youtube" });
  save();
  startYouTube();
}

export function setAmbienceVolume(volume: number) {
  loadAmbience();
  const v = clampVolume(volume);
  set({ volume: v });
  save();
  if (ctx && master) master.gain.setTargetAtTime(loudness(v), ctx.currentTime, 0.05);
  if (trackEl && !trackEl.paused && !state.paused) {
    clearInterval(trackFade);
    trackEl.volume = trackLevel();
  }
}

/** Starts the remembered sound again, if there is one. Also needs to come from a press. The focus track waits for a session. */
export function resumeAmbience() {
  const { sound, playing } = loadAmbience();
  if (sound === "track") return;
  if (sound === "youtube") {
    if (!playing) startYouTube();
  } else if (sound && !current) startSound(sound);
}

/** Fades out whatever is playing, keeping the choice for next time. */
export function stopAmbience() {
  if (current && ctx) fadeOut(current, ctx);
  current = null;
  quietTrack();
  heldBySession = false;
  set({ playing: false, paused: false });
}

/* ---- The focus session drives the focus track ---- */

/** A session just locked in: the focus track starts, if that's the choice. Call it from the press. */
export function startFocusMusic() {
  focusing = true;
  const { sound, playing, paused } = loadAmbience();
  if (sound === "track") {
    if (!playing || paused) startTrack();
  } else resumeAmbience();
}

/** The session paused or resumed. The track follows, but only back on if it was the session that paused it. */
export function holdFocusMusic(hold: boolean) {
  if (state.sound !== "track") return;
  // the page was opened on a paused session, so nothing has started the music yet
  if (!hold && !focusing) return startFocusMusic();
  if (!trackEl) return;
  if (hold) {
    if (!state.playing || state.paused) return;
    quietTrack();
    heldBySession = true;
    set({ paused: true });
  } else if (heldBySession && state.playing) startTrack();
}

/** The session ended: the focus track fades out. Other sounds keep going, as they always have. */
export function endFocusMusic() {
  focusing = false;
  if (state.sound !== "track" || !state.playing) return;
  quietTrack();
  heldBySession = false;
  set({ playing: false, paused: false });
}

/** The pause button on the track's pill. */
export function toggleFocusTrack() {
  if (state.sound !== "track" || !state.playing) return;
  if (state.paused) return startTrack();
  quietTrack();
  heldBySession = false;
  set({ paused: true });
}
