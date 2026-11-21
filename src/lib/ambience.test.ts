import { describe, expect, it } from "vitest";
import { AMBIENCES, DEFAULT_PREFS, LOFI_CHORDS, LOFI_SCALE, clampVolume, isAmbienceId, lofiBeat, midiHz, parsePrefs } from "./ambience";

describe("saved music choice", () => {
  it("reads back what was saved", () => {
    expect(parsePrefs(JSON.stringify({ sound: "rain", volume: 0.3 }))).toEqual({ sound: "rain", volume: 0.3, youtube: null });
  });

  it("falls back to nothing playing at the default volume", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("not json")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("null")).toEqual(DEFAULT_PREFS);
  });

  it("drops a sound that no longer exists and keeps the volume in range", () => {
    expect(parsePrefs(JSON.stringify({ sound: "whale-song", volume: 4 }))).toEqual({ sound: null, volume: 1, youtube: null });
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_PREFS.volume);
    expect(clampVolume("0.5")).toBe(DEFAULT_PREFS.volume);
  });

  it("remembers a YouTube link, and drops the choice if the link is broken", () => {
    const youtube = { video: "jfKfPfyJRdk", list: null };
    expect(parsePrefs(JSON.stringify({ sound: "youtube", volume: 0.5, youtube }))).toEqual({ sound: "youtube", volume: 0.5, youtube });
    expect(parsePrefs(JSON.stringify({ sound: "youtube", youtube: { video: "bad" } }))).toEqual({ ...DEFAULT_PREFS });
  });

  it("knows every listed sound", () => {
    for (const a of AMBIENCES) expect(isAmbienceId(a.id)).toBe(true);
    expect(isAmbienceId(null)).toBe(false);
  });
});

describe("the lo-fi loop", () => {
  it("tunes A4 to 440 Hz and an octave doubles", () => {
    expect(midiHz(69)).toBe(440);
    expect(midiHz(81)).toBeCloseTo(880);
  });

  it("changes chord on the first beat of every bar and cycles through them", () => {
    const never = () => 0.99;
    const chords = Array.from({ length: 20 }, (_, i) => lofiBeat(i, never).chord);
    expect(chords.filter(Boolean)).toHaveLength(5);
    expect(chords[0]).toBe(LOFI_CHORDS[0]);
    expect(chords[4]).toBe(LOFI_CHORDS[1]);
    expect(chords[16]).toBe(LOFI_CHORDS[0]);
  });

  it("puts the kick on 1 and 3 and the snare on 2 and 4", () => {
    const bar = [0, 1, 2, 3].map((i) => lofiBeat(i, () => 0.99));
    expect(bar.map((b) => b.kick)).toEqual([true, false, true, false]);
    expect(bar.map((b) => b.snare)).toEqual([false, true, false, true]);
  });

  it("plays keys only from the scale, and rests sometimes", () => {
    expect(lofiBeat(1, () => 0.9).note).toBeNull();
    for (const r of [0, 0.2, 0.44, 0.9999]) {
      const rolls = [0.1, r];
      const note = lofiBeat(1, () => rolls.shift()!).note;
      expect(LOFI_SCALE).toContain(note);
    }
  });

  it("keeps every note in a comfortable range", () => {
    for (const n of [...LOFI_CHORDS.flat(), ...LOFI_SCALE]) {
      expect(midiHz(n)).toBeGreaterThan(80);
      expect(midiHz(n)).toBeLessThan(1000);
    }
  });
});
