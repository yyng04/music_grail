import { useAppStore } from "../state/index.ts";
import { Spelled } from "./Spelled.tsx";
import { targetName } from "./spelling.ts";

export function Header() {
  const compare = useAppStore((s) => s.selection.compare);
  const clearCompare = useAppStore((s) => s.clearCompare);
  const audioEnabled = useAppStore((s) => s.audioEnabled);
  const setAudioEnabled = useAppStore((s) => s.setAudioEnabled);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  return (
    <header className="header">
      <h1 className="brand">Music Theory Centre</h1>
      <nav className="tabs" aria-label="Views">
        <button
          type="button"
          aria-current={view === "circle" ? "page" : undefined}
          onClick={() => {
            setView("circle");
          }}
        >
          Circle
        </button>
        <button
          type="button"
          aria-current={view === "fretboard" ? "page" : undefined}
          onClick={() => {
            setView("fretboard");
          }}
        >
          Fretboard
        </button>
      </nav>
      <div className="tools">
        {compare && (
          <span className="vs">
            vs{" "}
            <b>
              <Spelled text={targetName(compare)} />
            </b>
            <button
              type="button"
              aria-label="Clear compare"
              onClick={clearCompare}
            >
              ×
            </button>
          </span>
        )}
        <button
          type="button"
          aria-pressed={audioEnabled}
          onClick={() => {
            setAudioEnabled(!audioEnabled);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {audioEnabled ? (
              <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
            ) : (
              <path d="m17 9 5 6m0-6-5 6" />
            )}
          </svg>
          <span className="label">
            {audioEnabled ? "Sound on" : "Sound off"}
          </span>
        </button>
      </div>
    </header>
  );
}
