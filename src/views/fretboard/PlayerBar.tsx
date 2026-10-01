import { useId, useRef, useState } from "react";
import { restartMetronome, toggleMetronome } from "../../audio/metronome.ts";
import { unlockAudio } from "../../audio/index.ts";
import {
  beatsOf,
  SIGS,
  stylesFor,
  tapTempo,
  type DrumStyle,
  type Sig,
} from "../../audio/rhythm.ts";
import { Choice } from "../../components/Choice.tsx";
import { useMediaQuery } from "../../hooks/useMediaQuery.ts";
import {
  clampTempo,
  MAX_TEMPO,
  MIN_TEMPO,
  useAppStore,
} from "../../state/index.ts";
import { tuning } from "../../theory/index.ts";
import { progressionNow } from "./shapeModel.ts";

function StartStop({ compact }: { compact: boolean }) {
  const running = useAppStore((s) => s.playback.running);
  const empty = useAppStore((s) => s.progression.text.trim() === "");
  return (
    <button
      type="button"
      className={`prog-start${compact ? " small" : ""}`}
      aria-pressed={running}
      aria-keyshortcuts="Space"
      disabled={empty && !running}
      onClick={toggleMetronome}
    >
      <svg viewBox="0 0 14 14" aria-hidden="true">
        {running ? (
          <rect x="2.5" y="2.5" width="9" height="9" />
        ) : (
          <path d="M3.5 1.8v10.4L12 7z" />
        )}
      </svg>
      <span className={compact ? "sr-only" : undefined}>
        {running ? "Stop" : "Start"}
      </span>
    </button>
  );
}

/** Tempo: a number field (kept as typed until it is left), minus and plus, and tap tempo. */
function Tempo({ compact }: { compact: boolean }) {
  const id = useId();
  const tempo = useAppStore((s) => s.progression.tempo);
  const sig = useAppStore((s) => s.progression.sig);
  const setProgression = useAppStore((s) => s.setProgression);
  const [typed, setTyped] = useState<string | null>(null);
  const taps = useRef<number[]>([]);
  const compound = beatsOf(sig).eighths === 3;
  const commit = () => {
    const n = Number(typed);
    if (typed !== null && typed.trim() !== "" && Number.isFinite(n))
      setProgression({ tempo: clampTempo(n) });
    setTyped(null);
  };
  return (
    <div className="prog-group" role="group" aria-labelledby={id}>
      <span className={compact ? "sr-only" : "choice-label"} id={id}>
        Tempo{compound ? ", dotted quarters" : ""}
      </span>
      <div className="tempo">
        <button
          type="button"
          aria-label="Slower"
          disabled={tempo <= MIN_TEMPO}
          onClick={() => {
            setProgression({ tempo: tempo - 1 });
          }}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_TEMPO}
          max={MAX_TEMPO}
          value={typed ?? tempo}
          aria-label="Beats per minute"
          onChange={(e) => {
            setTyped(e.target.value);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
        <button
          type="button"
          aria-label="Faster"
          disabled={tempo >= MAX_TEMPO}
          onClick={() => {
            setProgression({ tempo: tempo + 1 });
          }}
        >
          +
        </button>
        <span className="unit" aria-hidden="true">
          BPM
        </span>
        {!compact && (
          <button
            type="button"
            className="tap"
            aria-label="Tap tempo"
            onClick={() => {
              taps.current = [...taps.current, performance.now()].slice(-6);
              const bpm = tapTempo(taps.current);
              if (bpm) setProgression({ tempo: bpm });
            }}
          >
            Tap
          </button>
        )}
      </div>
    </div>
  );
}

function TimeChoice() {
  const sig = useAppStore((s) => s.progression.sig);
  const setProgression = useAppStore((s) => s.setProgression);
  return (
    <Choice<Sig>
      stacked
      name="Time"
      options={SIGS.map((s) => ({ value: s, text: s }))}
      value={sig}
      onChange={(next) => {
        if (next === sig) return;
        setProgression({ sig: next });
        // The bar changes length, so playing starts again from the count-in.
        restartMetronome();
      }}
    />
  );
}

function DrumChoice() {
  const sig = useAppStore((s) => s.progression.sig);
  const drums = useAppStore((s) => s.progression.drums);
  const setProgression = useAppStore((s) => s.setProgression);
  return (
    <Choice<DrumStyle>
      stacked
      name="Backing"
      options={stylesFor(sig).map((s) => ({ value: s.value, text: s.text }))}
      value={drums}
      onChange={(next) => {
        unlockAudio();
        setProgression({ drums: next });
      }}
    />
  );
}

function Volumes() {
  const click = useAppStore((s) => s.progression.clickVolume);
  const drums = useAppStore((s) => s.progression.drumVolume);
  const setProgression = useAppStore((s) => s.setProgression);
  return (
    <div className="prog-group" role="group" aria-label="Volume">
      <span className="choice-label" aria-hidden="true">
        Volume
      </span>
      <div className="volumes">
        <label>
          Click
          <input
            type="range"
            min={0}
            max={100}
            value={click}
            onChange={(e) => {
              setProgression({ clickVolume: Number(e.target.value) });
            }}
          />
        </label>
        <label>
          Drums
          <input
            type="range"
            min={0}
            max={100}
            value={drums}
            onChange={(e) => {
              setProgression({ drumVolume: Number(e.target.value) });
            }}
          />
        </label>
      </div>
    </div>
  );
}

/** Bar and beat in words, and one mark per beat (per eighth in 6/8 and 12/8), beat 1 taller. */
function Beats({ compact }: { compact: boolean }) {
  const progression = useAppStore((s) => s.progression);
  const playback = useAppStore((s) => s.playback);
  const fretboard = useAppStore((s) => s.fretboard);
  const now = progressionNow(
    progression,
    playback,
    tuning(fretboard.instrument, fretboard.tuning).strings,
  );
  const { count, eighths } = beatsOf(progression.sig);
  const lit = playback.running ? playback.beat * eighths : -1;
  const beat = String(playback.beat + 1);
  const total = `${String(now.total)} bar${now.total === 1 ? "" : "s"}`;
  const words = !playback.running
    ? compact
      ? total
      : `Stopped · ${total}`
    : playback.countIn
      ? compact
        ? `Count-in · ${beat}`
        : `Count-in · beat ${beat}`
      : compact
        ? `Bar ${String(now.bar + 1)} · ${beat}`
        : `Bar ${String(now.bar + 1)} of ${String(now.total)} · beat ${beat}`;
  return (
    <div className={`prog-beats${compact ? " compact" : ""}`}>
      <span className="beat-words">{words}</span>
      <span className="beat-marks" aria-hidden="true">
        {Array.from({ length: count * eighths }, (_, i) => (
          <span
            key={i}
            className={`mark${i % eighths === 0 ? "" : " eighth"}${i === 0 ? " one" : ""}${i === lit ? " on" : ""}`}
          />
        ))}
      </span>
    </div>
  );
}

/**
 * The metronome, in a bar fixed along the bottom of the window so it stays
 * in reach while the board scrolls. On phones, time, backing and volume open
 * upward from a summary line.
 */
export function PlayerBar() {
  const compact = useMediaQuery("(max-width: 760px)");
  const [open, setOpen] = useState(false);
  const sig = useAppStore((s) => s.progression.sig);
  const drums = useAppStore((s) => s.progression.drums);
  const moreId = useId();
  return (
    <div className="player-bar" role="region" aria-label="Metronome">
      {compact && open && (
        <div className="player-more" id={moreId}>
          <TimeChoice />
          <DrumChoice />
          <Volumes />
        </div>
      )}
      <div className="player-row">
        <StartStop compact={compact} />
        <Beats compact={compact} />
        <Tempo compact={compact} />
        {compact ? (
          <button
            type="button"
            className="player-toggle"
            aria-expanded={open}
            aria-controls={moreId}
            onClick={() => {
              setOpen(!open);
            }}
          >
            {sig} · {stylesFor(sig).find((s) => s.value === drums)?.text}
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d={open ? "M2 4l4 4 4-4" : "M2 8l4-4 4 4"} />
            </svg>
          </button>
        ) : (
          <>
            <TimeChoice />
            <DrumChoice />
            <Volumes />
          </>
        )}
      </div>
    </div>
  );
}
