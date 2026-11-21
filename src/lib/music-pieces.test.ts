import { describe, expect, it } from "vitest";
import { AMBIENCES } from "./ambience";
import { PIECES, pieceBeat, type Piece } from "./music-pieces";

const pieces = Object.entries(PIECES) as [string, Piece][];

describe("instrument pieces", () => {
  it("every piece is in the Music menu", () => {
    const ids = AMBIENCES.map((a) => a.id as string);
    for (const [id] of pieces) expect(ids).toContain(id);
  });

  it("has four chords and a scale low to high, in a range people can hear comfortably", () => {
    for (const [, p] of pieces) {
      expect(p.chords).toHaveLength(4);
      expect([...p.scale]).toEqual([...p.scale].sort((a, b) => a - b));
      for (const n of [...p.chords.flat(), ...p.scale]) {
        expect(n).toBeGreaterThanOrEqual(36);
        expect(n).toBeLessThanOrEqual(96);
      }
    }
  });

  it("changes chord at the start of each bar", () => {
    const p = PIECES.piano;
    const chords = Array.from({ length: 16 }, (_, i) => pieceBeat(p, i, () => 0.99).chord);
    expect(chords.filter(Boolean)).toEqual([p.chords[0], p.chords[1], p.chords[2], p.chords[3]]);
  });

  it("walks the melody by at most two steps and stays in the scale", () => {
    for (const [, p] of pieces) {
      let prev = -1;
      for (let beat = 0; beat < 200; beat++) {
        const b = pieceBeat(p, beat, Math.random, prev);
        if (!b.lead) continue;
        expect(p.scale[b.lead.index]).toBe(b.lead.note);
        if (prev >= 0) expect(Math.abs(b.lead.index - prev)).toBeLessThanOrEqual(2);
        prev = b.lead.index;
      }
    }
  });

  it("rests when the dice say so", () => {
    expect(pieceBeat(PIECES.violin, 0, () => 0.999).lead).toBeNull();
  });

  it("picks the chord out in eighth notes for arpeggio pieces only", () => {
    const arp = pieceBeat(PIECES.guitar, 1, () => 0.99).arp;
    expect(arp.map((a) => a.offset)).toEqual([0, 0.5]);
    for (const a of arp) expect(PIECES.guitar.chords[0].map((n) => n % 12)).toContain(a.note % 12);
    expect(pieceBeat(PIECES.violin, 1, () => 0.99).arp).toEqual([]);
  });

  it("walks the upright bass every beat and keeps it low", () => {
    const bass = [0, 1, 2, 3].map((i) => pieceBeat(PIECES.sax, i, () => 0.99).bass);
    for (const n of bass) {
      expect(n).not.toBeNull();
      expect(n!).toBeGreaterThanOrEqual(36);
      expect(n!).toBeLessThan(48);
    }
    expect(pieceBeat(PIECES.violin, 1, () => 0.99).bass).toBeNull();
    expect(pieceBeat(PIECES.violin, 0, () => 0.99).bass).not.toBeNull();
  });

  it("brushes swish every beat and tap on 2 and 4, only in the sax piece", () => {
    const bar = [0, 1, 2, 3].map((i) => pieceBeat(PIECES.sax, i, () => 0.99));
    expect(bar.map((b) => b.tap)).toEqual([false, true, false, true]);
    expect(bar.every((b) => b.swish)).toBe(true);
    expect(pieceBeat(PIECES.piano, 1, () => 0.99).swish).toBe(false);
  });
});
