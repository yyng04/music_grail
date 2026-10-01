import { boardInstrument, play, unlockAudio } from "../../audio/index.ts";
import { useId } from "react";
import { Spelled } from "../../components/Spelled.tsx";
import { useMediaQuery } from "../../hooks/useMediaQuery.ts";
import { useAppStore } from "../../state/index.ts";
import { tuning } from "../../theory/index.ts";
import { Board } from "./Board.tsx";
import { FretboardBar } from "./FretboardBar.tsx";
import { PlayerBar } from "./PlayerBar.tsx";
import { ShapeBar } from "./ShapeBar.tsx";
import { stepStrip, useBoardModel } from "./shapeModel.ts";
import { ShapeStrip } from "./ShapeStrip.tsx";

/**
 * The fretboard view: instrument and labels, the Show controls
 * and the strip directly above the board, then the board. The key panel
 * follows below it.
 */
export function Fretboard() {
  const settings = useAppStore((s) => s.fretboard);
  const upright = useMediaQuery("(max-width: 600px)");
  const model = useBoardModel();
  const boardId = useId();
  const strings = tuning(settings.instrument, settings.tuning).strings;
  const step = (dir: 1 | -1) => {
    stepStrip(dir);
  };
  return (
    <div className={`fretboard${upright ? " upright" : ""}`}>
      <FretboardBar upright={upright} />
      <ShapeBar model={model} compact={upright} boardId={boardId} />
      {/* Progression mode has its own strip of chords above. */}
      {model.mode !== "progression" && (
        <ShapeStrip
          model={model}
          strings={strings.length}
          frets={settings.frets}
          orient={{
            upright,
            lowOnTop: settings.lowOnTop,
            leftHanded: settings.leftHanded,
          }}
          onStep={step}
        />
      )}
      <p className="board-reference" aria-live="polite">
        <Spelled text={model.reference} />
      </p>
      <Board
        id={boardId}
        strings={strings}
        frets={settings.frets}
        leftHanded={settings.leftHanded}
        lowOnTop={settings.lowOnTop}
        bare={settings.label === "none" && model.mode !== "guide"}
        model={model}
        onStep={step}
        onNote={(note) => {
          // A dot plays its exact pitch, in the octave it sounds on the neck.
          unlockAudio();
          play(boardInstrument(), [{ notes: [note.pitch], style: "note" }]);
        }}
      />
      {model.mode === "progression" && <PlayerBar />}
    </div>
  );
}
