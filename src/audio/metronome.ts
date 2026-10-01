// The metronome: a click or a drum pattern on Tone's Transport, one bar of
// count-in, and the beat display and the board moved on the audio clock
// (Tone's Draw), never with timers. It never plays the progression's chords.
import type { Gain, Players, Synth } from "tone";
import {
  chordAtBar,
  parseProgression,
  progressionChords,
} from "../relations/index.ts";
import { appStore, barsFor, STOPPED } from "../state/index.ts";
import { loadTone, unlockAudio } from "./index.ts";
import {
  clickAt,
  drumHits,
  GRID,
  SOUNDS,
  stepAt,
  type Click,
  type Level,
} from "./rhythm.ts";

type Tone = typeof import("tone");

let rig:
  | Promise<{ T: Tone; click: Synth; clickGain: Gain; drumGain: Gain }>
  | undefined;
let drums: Promise<Players> | undefined;
/** The drum samples once loaded; until then the click keeps time. */
let kit: Players | undefined;
let repeat: number | undefined;

const CLICK: Record<Click, { note: string; velocity: number }> = {
  accent: { note: "C6", velocity: 1 },
  beat: { note: "G5", velocity: 0.7 },
  eighth: { note: "G5", velocity: 0.35 },
};
// Normal hits use the loud sample a little quieter; soft hits the soft sample.
const DRUM_DB: Record<Level, number> = { accent: 0, normal: -4, soft: 0 };

const gainOf = (volume: number) => (volume / 100) ** 2;

function loadRig() {
  rig ??= loadTone().then((T) => {
    const clickGain = new T.Gain(
      gainOf(appStore.getState().progression.clickVolume),
    ).toDestination();
    const drumGain = new T.Gain(
      gainOf(appStore.getState().progression.drumVolume),
    ).toDestination();
    const click = new T.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }).connect(clickGain);
    return { T, click, clickGain, drumGain };
  });
  return rig;
}

/** The drum samples (CC0, see CREDITS.md), loaded the first time drums are chosen. */
export function loadDrums(): Promise<Players> {
  unlockAudio();
  drums ??= loadRig().then(
    ({ T, drumGain }) =>
      new Promise<Players>((resolve, reject) => {
        const names = SOUNDS.flatMap((s) => [s, `${s}-soft`]);
        const players: Players = new T.Players(
          Object.fromEntries(names.map((n) => [n, `${n}.mp3`])),
          {
            baseUrl: `${import.meta.env.BASE_URL}samples/drums/`,
            fadeOut: 0.03,
            onload: () => {
              kit = players;
              resolve(players);
            },
            onerror: (e) => {
              reject(e);
            },
          },
        ).connect(drumGain);
      }),
  );
  return drums;
}

/** Starts from the count-in. Turns sound on. */
export async function startMetronome(): Promise<void> {
  unlockAudio();
  const state = appStore.getState();
  state.setAudioEnabled(true);
  state.setPlayback({ ...STOPPED, running: true, countIn: true });
  const { T, click } = await loadRig();
  if (state.progression.drums !== "off")
    await loadDrums().catch(() => undefined);
  if (!appStore.getState().playback.running) return;
  const transport = T.getTransport();
  transport.stop();
  transport.cancel();
  transport.bpm.value = appStore.getState().progression.tempo;
  const draw = T.getDraw();
  let n = 0;
  repeat = transport.scheduleRepeat(
    (time) => {
      const { progression } = appStore.getState();
      const step = stepAt(n, progression.sig);
      n += 1;
      const hits = kit
        ? drumHits(progression.drums, progression.sig, step)
        : [];
      // The drums replace the click, except in the count-in.
      if (progression.drums === "off" || step.countIn || !kit) {
        const c = clickAt(step, progression.sig);
        if (c)
          click.triggerAttackRelease(
            CLICK[c].note,
            0.03,
            time,
            CLICK[c].velocity,
          );
      }
      const players = kit;
      if (players)
        for (const hit of hits) {
          // A closed hi-hat cuts the open one off, as on a real kit.
          if (hit.sound === "hat" || hit.sound === "pedal")
            for (const open of ["open", "open-soft"])
              if (players.player(open).state === "started")
                players.player(open).stop(time);
          const p = players.player(
            hit.level === "soft" ? `${hit.sound}-soft` : hit.sound,
          );
          p.volume.setValueAtTime(DRUM_DB[hit.level], time);
          p.start(time);
        }
      if (step.sub === 0)
        draw.schedule(() => {
          if (!appStore.getState().playback.running) return;
          appStore.getState().setPlayback({
            countIn: step.countIn,
            bar: step.bar,
            beat: step.beat,
          });
        }, time);
    },
    `${String(transport.PPQ / GRID)}i`,
    0,
  );
  transport.start("+0.05");
}

/** Stops, and leaves the board on the chord that was playing. */
export function stopMetronome(): void {
  const state = appStore.getState();
  if (!state.playback.running) return;
  const { bar, countIn } = state.playback;
  const chords = progressionChords(parseProgression(state.progression.text));
  const bars = barsFor(state.progression.bars, chords.length);
  state.setPlayback(STOPPED);
  state.setProgression({ current: countIn ? 0 : chordAtBar(bars, bar) });
  void rig?.then(({ T }) => {
    const transport = T.getTransport();
    transport.stop();
    if (repeat !== undefined) transport.clear(repeat);
    repeat = undefined;
    transport.cancel();
    void drums?.then((p) => p.stopAll());
  });
}

export function toggleMetronome(): void {
  if (appStore.getState().playback.running) stopMetronome();
  else void startMetronome();
}

/** Restarts from the count-in, when the bar length changes while running. */
export function restartMetronome(): void {
  if (!appStore.getState().playback.running) return;
  stopMetronome();
  void startMetronome();
}

// Tempo and volumes follow the controls while running; leaving Progression
// mode, the fretboard or sound stops the metronome.
appStore.subscribe((state, previous) => {
  const p = state.progression;
  if (p.tempo !== previous.progression.tempo)
    void rig?.then(({ T }) => {
      T.getTransport().bpm.rampTo(p.tempo, 0.05);
    });
  if (
    p.clickVolume !== previous.progression.clickVolume ||
    p.drumVolume !== previous.progression.drumVolume
  )
    void rig?.then(({ clickGain, drumGain }) => {
      clickGain.gain.rampTo(gainOf(p.clickVolume), 0.05);
      drumGain.gain.rampTo(gainOf(p.drumVolume), 0.05);
    });
  if (p.drums !== "off" && p.drums !== previous.progression.drums)
    void loadDrums().catch(() => undefined);
  if (
    state.playback.running &&
    (state.view !== "fretboard" ||
      state.shapes.mode !== "progression" ||
      !state.audioEnabled)
  )
    stopMetronome();
});
