import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  AMBIENCES,
  DEFAULT_PREFS,
  FOCUS_TRACK,
  LOFI_CHORDS,
  LOFI_SCALE,
  clampVolume,
  isAmbienceId,
  lofiBeat,
  midiHz,
  parsePrefs,
} from "./ambience";

describe("saved music choice", () => {
  it("reads back what was saved", () => {
    expect(parsePrefs(JSON.stringify({ sound: "rain", volume: 0.3 }))).toEqual({ sound: "rain", volume: 0.3, youtube: null });
  });

  it("falls back to the focus track at the default volume", () => {
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
    expect(parsePrefs(JSON.stringify({ sound: "youtube", youtube: { video: "bad" } }))).toEqual({
      sound: null,
      volume: 0.6,
      youtube: null,
    });
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

describe("the focus track", () => {
  /** Stands in for the browser's audio element, counting what the player asked of it. */
  class FakeAudio {
    static last: FakeAudio | null = null;
    paused = true;
    volume = 1;
    loop = false;
    preload = "";
    plays = 0;
    constructor(public src: string) {
      FakeAudio.last = this;
    }
    play() {
      this.plays++;
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }

  // the player keeps module state, so each case gets a fresh copy with its own saved choice
  async function freshPlayer(saved: string | null) {
    vi.resetModules();
    FakeAudio.last = null;
    const g = globalThis as Record<string, unknown>;
    g.localStorage = { getItem: () => saved, setItem: () => {}, removeItem: () => {} };
    g.Audio = FakeAudio;
    return import("./ambience");
  }

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).localStorage;
    delete (globalThis as Record<string, unknown>).Audio;
  });

  it("ships with the app", () => {
    expect(existsSync(join("public", FOCUS_TRACK.src))).toBe(true);
  });

  it("is the choice for someone who has never picked a sound", () => {
    expect(DEFAULT_PREFS.sound).toBe("track");
    expect(parsePrefs(JSON.stringify({ sound: "track", volume: 0.4 })).sound).toBe("track");
  });

  it("waits for a session: opening the page or picking it plays nothing", async () => {
    const a = await freshPlayer(null);
    a.resumeAmbience();
    a.playAmbience("track");
    expect(FakeAudio.last?.plays ?? 0).toBe(0);
    expect(a.getAmbience()).toMatchObject({ sound: "track", playing: false });
  });

  it("starts when a session locks in, looping", async () => {
    const a = await freshPlayer(null);
    a.startFocusMusic();
    expect(FakeAudio.last).toMatchObject({ src: FOCUS_TRACK.src, loop: true, plays: 1, paused: false });
    expect(a.getAmbience()).toMatchObject({ playing: true, paused: false });
  });

  it("stops with the stop button, and comes back with the next session", async () => {
    vi.useFakeTimers();
    const a = await freshPlayer(null);
    a.startFocusMusic();
    a.stopAmbience();
    vi.runAllTimers();
    expect(FakeAudio.last?.paused).toBe(true);
    expect(a.getAmbience()).toMatchObject({ sound: "track", playing: false });

    a.holdFocusMusic(true);
    a.holdFocusMusic(false);
    expect(FakeAudio.last?.plays).toBe(1); // stopped means stopped, for the rest of this session

    a.endFocusMusic();
    a.startFocusMusic();
    expect(FakeAudio.last?.plays).toBe(2);
  });

  it("pauses with the session and picks up when it resumes", async () => {
    vi.useFakeTimers();
    const a = await freshPlayer(null);
    a.startFocusMusic();
    a.holdFocusMusic(true);
    vi.runAllTimers();
    expect(FakeAudio.last?.paused).toBe(true);
    expect(a.getAmbience()).toMatchObject({ playing: true, paused: true });
    a.holdFocusMusic(false);
    expect(a.getAmbience().paused).toBe(false);
    expect(FakeAudio.last?.plays).toBe(2);
  });

  it("stays paused when you paused it yourself, whatever the session does", async () => {
    const a = await freshPlayer(null);
    a.startFocusMusic();
    a.toggleFocusTrack();
    a.holdFocusMusic(true);
    a.holdFocusMusic(false);
    expect(a.getAmbience().paused).toBe(true);
    a.toggleFocusTrack();
    expect(a.getAmbience().paused).toBe(false);
  });

  it("ends with the session", async () => {
    vi.useFakeTimers();
    const a = await freshPlayer(null);
    a.startFocusMusic();
    a.endFocusMusic();
    vi.runAllTimers();
    expect(FakeAudio.last?.paused).toBe(true);
    expect(a.getAmbience().playing).toBe(false);
  });

  it("leaves a saved choice alone, silence included", async () => {
    const silent = await freshPlayer(JSON.stringify({ sound: null, volume: 0.6 }));
    silent.startFocusMusic();
    expect(silent.getAmbience()).toMatchObject({ sound: null, playing: false });
    expect(FakeAudio.last).toBeNull();
  });
});
