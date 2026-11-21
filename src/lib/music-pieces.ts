/**
 * The instrument pieces in the Music menu, as plain data: chords, a scale for the melody, and which
 * synthesized instruments play what. `ambience.ts` turns them into sound; this file stays testable.
 * Each piece is generative, so it never plays the same way twice and never loops audibly.
 */

/** Melody and arpeggio voices. */
export type Lead = "piano" | "violin" | "cello" | "sax" | "guitar" | "flute" | "bells" | "harp";

export type Piece = {
  bpm: number;
  /** One chord per bar, as MIDI note numbers. */
  chords: readonly (readonly number[])[];
  /** Notes the melody may use, low to high. Chosen so every note sits well over every chord. */
  scale: readonly number[];
  lead: Lead;
  /** The chance of a new melody note on a beat where one may start. */
  density: number;
  /** How long each melody note lasts, in beats. */
  noteBeats: number;
  /** An instrument picking out the chord in eighth notes, or null. */
  arp: Lead | null;
  /** Held chords under everything. */
  pad: "strings" | "keys" | null;
  bass: "soft" | "upright" | null;
  /** Brushes on a snare: a swish every beat and a tap on 2 and 4. */
  brushes: boolean;
};

const AM_F_C_G = [
  [45, 52, 57, 60],
  [41, 48, 53, 57],
  [48, 52, 55, 60],
  [43, 50, 55, 59],
];

export const PIECES = {
  piano: {
    bpm: 64,
    // Cmaj7, Am7, Fmaj7, G7
    chords: [
      [48, 55, 59, 64],
      [45, 52, 55, 60],
      [41, 48, 52, 57],
      [43, 50, 53, 59],
    ],
    scale: [67, 69, 72, 74, 76, 79, 81, 84],
    lead: "piano",
    density: 0.5,
    noteBeats: 2,
    arp: "piano",
    pad: null,
    bass: null,
    brushes: false,
  },
  violin: {
    bpm: 54,
    // Dm, Bb, F, C
    chords: [
      [50, 57, 62, 65],
      [46, 53, 58, 62],
      [41, 53, 57, 60],
      [48, 55, 60, 64],
    ],
    scale: [62, 64, 65, 67, 69, 70, 72, 74, 76, 77],
    lead: "violin",
    density: 0.6,
    noteBeats: 2,
    arp: null,
    pad: "strings",
    bass: "soft",
    brushes: false,
  },
  cello: {
    bpm: 50,
    chords: AM_F_C_G,
    scale: [45, 47, 48, 50, 52, 53, 55, 57, 59, 60],
    lead: "cello",
    density: 0.5,
    noteBeats: 3,
    arp: null,
    pad: "strings",
    bass: null,
    brushes: false,
  },
  sax: {
    bpm: 76,
    // Cm7, F7, Bbmaj7, Gm7: a slow ii-V-I in B flat
    chords: [
      [48, 55, 58, 63],
      [41, 51, 57, 60],
      [46, 53, 57, 62],
      [43, 53, 58, 62],
    ],
    scale: [58, 60, 62, 65, 67, 70, 72, 74],
    lead: "sax",
    density: 0.5,
    noteBeats: 1.5,
    arp: null,
    pad: "keys",
    bass: "upright",
    brushes: true,
  },
  guitar: {
    bpm: 84,
    // G, D, Em, C
    chords: [
      [43, 47, 50, 55, 59],
      [50, 54, 57, 62],
      [40, 47, 52, 55, 59],
      [48, 52, 55, 60, 64],
    ],
    scale: [67, 69, 71, 74, 76, 79],
    lead: "guitar",
    density: 0.25,
    noteBeats: 1,
    arp: "guitar",
    pad: null,
    bass: null,
    brushes: false,
  },
  flute: {
    bpm: 66,
    chords: AM_F_C_G,
    scale: [69, 72, 74, 76, 79, 81],
    lead: "flute",
    density: 0.45,
    noteBeats: 2,
    arp: "harp",
    pad: null,
    bass: null,
    brushes: false,
  },
  musicbox: {
    bpm: 70,
    // F, Dm, Bb, C
    chords: [
      [53, 57, 60, 65],
      [50, 57, 62, 65],
      [46, 53, 58, 62],
      [48, 55, 60, 64],
    ],
    scale: [77, 79, 81, 84, 86, 89],
    lead: "bells",
    density: 0.5,
    noteBeats: 1,
    arp: "bells",
    pad: null,
    bass: null,
    brushes: false,
  },
} as const satisfies Record<string, Piece>;

export type PieceId = keyof typeof PIECES;

export type PieceBeat = {
  /** A new chord for the pad, on the first beat of each bar. */
  chord: readonly number[] | null;
  /** Arpeggio notes, each with its start in beats from this beat. */
  arp: { note: number; offset: number }[];
  /** A melody note and where it sits in the scale, or null for a rest. */
  lead: { note: number; index: number } | null;
  bass: number | null;
  swish: boolean;
  tap: boolean;
};

// up and back down the chord, two notes a beat
const ARP_PATTERN = [0, 1, 2, 3, 4, 3, 2, 1];

/** Moves a note into the octave starting at `low`. */
const into = (note: number, low: number) => {
  let n = note;
  while (n < low) n += 12;
  while (n >= low + 12) n -= 12;
  return n;
};

/**
 * What plays on beat number `beat`. The melody walks by small steps from `prev` (its last position
 * in the scale, or -1 at the start), so it sounds like a tune rather than random notes.
 * `rand` is Math.random in the player and fixed in tests.
 */
export function pieceBeat(piece: Piece, beat: number, rand: () => number, prev = -1): PieceBeat {
  const inBar = beat % 4;
  const chord = piece.chords[Math.floor(beat / 4) % piece.chords.length];

  const arp = piece.arp
    ? [0, 1].map((k) => {
        const i = ARP_PATTERN[(inBar * 2 + k) % ARP_PATTERN.length] % chord.length;
        return { note: chord[i] < 52 ? chord[i] + 12 : chord[i], offset: k / 2 };
      })
    : [];

  let lead: PieceBeat["lead"] = null;
  const step = Math.max(1, Math.round(piece.noteBeats));
  if (beat % step === 0 && rand() < piece.density) {
    const last = piece.scale.length - 1;
    const from = prev < 0 ? Math.floor(last / 2) : prev;
    const move = Math.floor(rand() * 5) - 2; // -2 to +2 steps
    const index = Math.min(last, Math.max(0, from + move));
    lead = { note: piece.scale[index], index };
  }

  let bass: number | null = null;
  if (piece.bass === "soft" && inBar === 0) bass = into(chord[0], 36);
  if (piece.bass === "upright") bass = into(chord[[0, 1, 2, 1][inBar] % chord.length], 36);

  return {
    chord: inBar === 0 ? chord : null,
    arp,
    lead,
    bass,
    swish: piece.brushes,
    tap: piece.brushes && inBar % 2 === 1,
  };
}
