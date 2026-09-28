import { useId, useState } from "react";
import { Choice, type ChoiceOption } from "../../components/Choice.tsx";
import {
  useAppStore,
  type DotLabel,
  type FretboardSettings,
} from "../../state/index.ts";
import {
  instrument,
  INSTRUMENTS,
  pitchClass,
  tuning,
} from "../../theory/index.ts";

const LABELS: ChoiceOption<DotLabel>[] = [
  { value: "note", text: "Note" },
  { value: "degree", text: "Degree" },
  { value: "interval", text: "Interval" },
  { value: "none", text: "None" },
];

/** The line above the board: instrument and tuning (opens the settings), focus chord, dot labels. */
export function FretboardBar({ upright }: { upright: boolean }) {
  const settings = useAppStore((s) => s.fretboard);
  const setFretboard = useAppStore((s) => s.setFretboard);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const inst = instrument(settings.instrument);
  const tune = tuning(settings.instrument, settings.tuning);
  const openNotes = tune.strings.map(pitchClass).join(" ");
  const set = (patch: Partial<FretboardSettings>) => {
    setFretboard(patch);
  };
  // Guide tones always name their notes, so the label choice steps aside.
  const guide = useAppStore((s) => s.shapes.mode === "guide");

  return (
    <>
      <div className="board-bar">
        <button
          type="button"
          className="board-setup"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <span>
            <b>{inst.name}</b>, {tune.phrase} ({openNotes})
          </span>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d={open ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"} />
          </svg>
        </button>
        {guide ? (
          <span className="board-note">Guide tones are named by note</span>
        ) : (
          <Choice
            name="Labels"
            showName={false}
            options={LABELS}
            value={settings.label}
            onChange={(label) => {
              set({ label });
            }}
          />
        )}
      </div>
      {open && (
        <div className="board-settings" id={panelId}>
          <Choice
            name="Instrument"
            options={INSTRUMENTS.map((i) => ({ value: i.id, text: i.name }))}
            value={settings.instrument}
            onChange={(id) => {
              set({ instrument: id });
            }}
          />
          {inst.tunings.length > 1 && (
            <Choice
              name="Tuning"
              options={inst.tunings.map((t) => ({ value: t.id, text: t.name }))}
              value={settings.tuning}
              onChange={(id) => {
                set({ tuning: id });
              }}
            />
          )}
          <Choice
            name="Frets"
            options={[...inst.frets]
              .sort((a, b) => a - b)
              .map((f) => ({ value: f, text: String(f) }))}
            value={settings.frets}
            onChange={(frets) => {
              set({ frets });
            }}
          />
          {/* Upright, the board always reads like a chord diagram: lowest string on the left. */}
          {!upright && (
            <Choice
              name="Strings"
              options={[
                { value: false, text: "High string on top" },
                { value: true, text: "Low string on top" },
              ]}
              value={settings.lowOnTop}
              onChange={(lowOnTop) => {
                set({ lowOnTop });
              }}
            />
          )}
          <Choice
            name="Hand"
            options={[
              { value: false, text: "Right" },
              { value: true, text: "Left" },
            ]}
            value={settings.leftHanded}
            onChange={(leftHanded) => {
              set({ leftHanded });
            }}
          />
          <Choice
            name="Notes outside the key"
            options={[
              { value: false, text: "Hidden" },
              { value: true, text: "Dimmed" },
            ]}
            value={settings.showOutside}
            onChange={(showOutside) => {
              set({ showOutside });
            }}
          />
        </div>
      )}
    </>
  );
}
